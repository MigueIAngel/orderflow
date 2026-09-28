import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  createServer,
  IncomingMessage,
  Server,
  ServerResponse,
} from 'node:http';
import { AddressInfo } from 'node:net';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/setup.js';

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
) => void;

const ORDER_ID = '7d3c5a38-6f0e-4b7a-9d41-1f0e6c2f9a11';

/** A tiny HTTP server standing in for a downstream service. */
async function fakeService(handler: Handler) {
  const seen: {
    method?: string;
    url?: string;
    requestId?: string;
    body: string;
  }[] = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      seen.push({
        method: req.method,
        url: req.url,
        requestId: req.headers['x-request-id'] as string,
        body,
      });
      handler(req, res, body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { server, url, seen };
}

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

describe('API gateway (e2e)', () => {
  let app: INestApplication;
  let servers: Server[];
  let inventory: Awaited<ReturnType<typeof fakeService>>;
  let orders: Awaited<ReturnType<typeof fakeService>>;
  let payments: Awaited<ReturnType<typeof fakeService>>;
  let paymentsHealthy: boolean;

  beforeEach(async () => {
    paymentsHealthy = true;
    inventory = await fakeService((req, res) => {
      if (req.url === '/health') return json(res, 200, { status: 'up' });
      if (req.url === '/openapi.json') {
        return json(res, 200, {
          openapi: '3.1.0',
          paths: { '/products': {}, '/health': {} },
        });
      }
      if (req.url?.startsWith('/reservations')) {
        return json(res, 200, [{ sku: 'KB-001', status: 'COMMITTED' }]);
      }
      json(res, 200, { path: req.url });
    });
    orders = await fakeService((req, res, body) => {
      if (req.url === '/health') return json(res, 200, { status: 'up' });
      if (req.method === 'POST') return json(res, 202, JSON.parse(body));
      if (req.url === `/orders/${ORDER_ID}`) {
        return json(res, 200, { id: ORDER_ID, status: 'CONFIRMED' });
      }
      json(res, 404, { message: 'not found' });
    });
    payments = await fakeService((req, res) => {
      if (!paymentsHealthy) return json(res, 500, { message: 'boom' });
      json(res, 200, { status: 'up' });
    });
    servers = [inventory.server, orders.server, payments.server];

    process.env.INVENTORY_URL = inventory.url;
    process.env.ORDERS_URL = orders.url;
    process.env.PAYMENTS_URL = payments.url;
    process.env.NOTIFICATIONS_URL = 'http://127.0.0.1:1'; // nothing listens here
    process.env.BREAKER_THRESHOLD = '2';
    process.env.RATE_LIMIT_ORDERS_PER_MIN = '3';

    app = await NestFactory.create(AppModule, {
      bodyParser: false,
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
    for (const server of servers) server.close();
  });

  const http = () => request(app.getHttpServer());

  it('routes /api/<prefix> to the owning service without the /api prefix', async () => {
    const res = await http().get('/api/products?skus=KB-001').expect(200);
    expect(res.body).toEqual({ path: '/products?skus=KB-001' });
  });

  it('streams request bodies through untouched', async () => {
    const order = {
      customerEmail: 'ada@example.com',
      items: [{ sku: 'KB-001', quantity: 1 }],
    };
    const res = await http().post('/api/orders').send(order).expect(202);
    expect(res.body).toEqual(order);
  });

  it('propagates x-request-id downstream and back', async () => {
    const res = await http()
      .get('/api/products')
      .set('x-request-id', 'trace-123456')
      .expect(200);
    expect(res.headers['x-request-id']).toBe('trace-123456');
    expect(inventory.seen.at(-1)?.requestId).toBe('trace-123456');
  });

  it('generates a request id when the client sends none', async () => {
    const res = await http().get('/api/products').expect(200);
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('answers 503 when a service is unreachable, then opens its circuit', async () => {
    const first = await http().get('/api/notifications').expect(503);
    expect(first.body).toMatchObject({
      service: 'notifications',
      reason: 'upstream_error',
    });
    await http().get('/api/notifications').expect(503);

    const open = await http().get('/api/notifications').expect(503);
    expect(open.body.reason).toBe('circuit_open');
    expect(Number(open.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts upstream 5xx as failures', async () => {
    paymentsHealthy = false;
    await http().get('/api/payments').expect(500);
    await http().get('/api/payments').expect(500);
    const res = await http().get('/api/payments').expect(503);
    expect(res.body.reason).toBe('circuit_open');
    expect(payments.seen).toHaveLength(2);
  });

  it('rate-limits order creation per client', async () => {
    const order = { customerEmail: 'a@b.co', items: [] };
    for (let i = 0; i < 3; i++)
      await http().post('/api/orders').send(order).expect(202);
    const res = await http().post('/api/orders').send(order).expect(429);
    expect(res.headers['retry-after']).toBeDefined();
    await http().get(`/api/orders/${ORDER_ID}`).expect(200);
  });

  it('aggregates health and reports what is down', async () => {
    const res = await http().get('/api/health').expect(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.services.inventory.status).toBe('up');
    expect(res.body.services.notifications).toMatchObject({
      status: 'down',
      latencyMs: null,
    });
  });

  it('composes an order summary and degrades gracefully', async () => {
    const res = await http().get(`/api/orders/${ORDER_ID}/summary`).expect(200);
    expect(res.body.order).toEqual({ id: ORDER_ID, status: 'CONFIRMED' });
    expect(res.body.reservations).toEqual([
      { sku: 'KB-001', status: 'COMMITTED' },
    ]);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.unavailable).toEqual(['notifications']);
    expect(orders.seen.some((r) => r.url?.endsWith('/summary'))).toBe(false);
  });

  it('returns 404 from the summary when the order does not exist', async () => {
    await http()
      .get('/api/orders/00000000-0000-4000-8000-000000000000/summary')
      .expect(404);
  });

  it('rewrites service OpenAPI documents to go through the gateway', async () => {
    const res = await http()
      .get('/api/docs/inventory/openapi.json')
      .expect(200);
    expect(res.body.servers).toEqual([{ url: '/api' }]);
    expect(Object.keys(res.body.paths)).toEqual(['/products']);
    await http().get('/api/docs/unknown/openapi.json').expect(404);
  });

  it('serves its own OpenAPI document', async () => {
    const res = await http().get('/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toEqual(
      expect.arrayContaining(['/api/health', '/api/orders/{id}/summary']),
    );
  });
});
