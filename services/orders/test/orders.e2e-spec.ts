import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { buildEvent, EventType } from '../src/messaging/event.js';
import { OutboxService } from '../src/messaging/outbox.service.js';
import { StreamConsumer } from '../src/messaging/stream-consumer.service.js';
import { StreamsClient } from '../src/messaging/streams.client.js';
import {
  CatalogClient,
  CatalogProduct,
  CatalogUnavailableError,
} from '../src/orders/catalog.client.js';
import { configureApp } from '../src/setup.js';
import { InMemoryStreams } from './support/in-memory-streams.js';

const STREAM = 'orderflow:events';

class FakeCatalog extends CatalogClient {
  down = false;
  products: CatalogProduct[] = [
    { sku: 'KB-001', name_en: 'Mechanical keyboard', price: 89 },
    { sku: 'MS-002', name_en: 'Wireless mouse', price: 39.9 },
  ];

  async findBySkus(skus: string[]) {
    if (this.down) throw new CatalogUnavailableError('Inventory is down');
    return this.products.filter((p) => skus.includes(p.sku));
  }
}

describe('Orders service (e2e)', () => {
  let app: INestApplication<App>;
  let streams: InMemoryStreams;
  let catalog: FakeCatalog;
  let outbox: OutboxService;
  let consumer: StreamConsumer;

  const http = () => request(app.getHttpServer());

  const placeOrder = async (body: object = {}) => {
    const res = await http()
      .post('/orders')
      .send({
        customerEmail: 'Ada@Example.com',
        items: [
          { sku: 'KB-001', quantity: 1 },
          { sku: 'MS-002', quantity: 2 },
        ],
        ...body,
      })
      .expect(202);
    return res.body as { id: string; total: number; status: string };
  };

  /** Simulates another service publishing an event, then lets the consumer run once. */
  const receive = async (type: EventType, data: object) => {
    const event = buildEvent(type, 'test', (data as any).orderId, data);
    await streams.publish(STREAM, { event: JSON.stringify(event) });
    await consumer.poll();
    return event;
  };

  const getOrder = async (id: string) =>
    (await http().get(`/orders/${id}`)).body;

  beforeEach(async () => {
    process.env.DATABASE_URL = 'sqlite::memory:';
    process.env.MESSAGING_ENABLED = 'false';
    process.env.PROCESSING_DELAY_MS = '0';
    streams = new InMemoryStreams();
    catalog = new FakeCatalog();

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(StreamsClient)
      .useValue(streams)
      .overrideProvider(CatalogClient)
      .useValue(catalog)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    outbox = app.get(OutboxService);
    consumer = app.get(StreamConsumer);
  });

  afterEach(async () => {
    await app.close();
  });

  it('accepts an order as PENDING with prices from the catalogue', async () => {
    const order = await placeOrder();
    expect(order.status).toBe('PENDING');
    expect(order.total).toBe(168.8);

    const body = await getOrder(order.id);
    expect(body.customerEmail).toBe('ada@example.com');
    expect(body.items).toHaveLength(2);
    expect(body.history.map((h: any) => h.status)).toEqual(['PENDING']);
  });

  it('publishes order.created through the outbox', async () => {
    const order = await placeOrder({ simulatePaymentFailure: true });
    expect(streams.entries(STREAM)).toHaveLength(0);

    expect(await outbox.publishPending()).toBe(1);
    expect(await outbox.publishPending()).toBe(0);

    const [event] = streams.events(STREAM);
    expect(event).toMatchObject({
      type: 'order.created',
      source: 'orders',
      correlationId: order.id,
      data: {
        orderId: order.id,
        total: 168.8,
        simulatePaymentFailure: true,
        items: [
          { sku: 'KB-001', quantity: 1, unitPrice: 89 },
          { sku: 'MS-002', quantity: 2, unitPrice: 39.9 },
        ],
      },
    });
  });

  it('merges repeated lines of the same SKU', async () => {
    const order = await placeOrder({
      items: [
        { sku: 'KB-001', quantity: 1 },
        { sku: 'KB-001', quantity: 2 },
      ],
    });
    const body = await getOrder(order.id);
    expect(body.items).toEqual([
      expect.objectContaining({ sku: 'KB-001', quantity: 3 }),
    ]);
  });

  it.each([
    [{ customerEmail: 'not-an-email' }],
    [{ items: [] }],
    [{ items: [{ sku: 'KB-001', quantity: 0 }] }],
    [{ unexpected: true }],
  ])('rejects invalid payload %j', async (patch) => {
    await http()
      .post('/orders')
      .send({
        customerEmail: 'ada@example.com',
        items: [{ sku: 'KB-001', quantity: 1 }],
        ...patch,
      })
      .expect(400);
  });

  it('rejects unknown SKUs', async () => {
    const res = await http()
      .post('/orders')
      .send({
        customerEmail: 'ada@example.com',
        items: [{ sku: 'NOPE', quantity: 1 }],
      })
      .expect(400);
    expect(res.body.message).toContain('NOPE');
  });

  it('returns 503 when the inventory service is unreachable', async () => {
    catalog.down = true;
    await http()
      .post('/orders')
      .send({
        customerEmail: 'ada@example.com',
        items: [{ sku: 'KB-001', quantity: 1 }],
      })
      .expect(503);
  });

  it('confirms the order when stock is reserved and payment succeeds', async () => {
    const order = await placeOrder();
    await receive('stock.reserved', { orderId: order.id, items: [] });
    expect((await getOrder(order.id)).status).toBe('STOCK_RESERVED');

    await receive('payment.succeeded', { orderId: order.id, amount: 168.8 });
    const body = await getOrder(order.id);
    expect(body.status).toBe('CONFIRMED');
    expect(body.history.map((h: any) => h.event)).toEqual([
      null,
      'stock.reserved',
      'payment.succeeded',
    ]);

    await outbox.publishPending();
    expect(streams.events(STREAM).map((e) => e.type)).toContain(
      'order.confirmed',
    );
  });

  it('cancels the order when stock is rejected and ignores later events', async () => {
    const order = await placeOrder();
    await receive('stock.rejected', {
      orderId: order.id,
      reason: 'out_of_stock',
      sku: 'KB-001',
    });
    await receive('payment.succeeded', { orderId: order.id });

    const body = await getOrder(order.id);
    expect(body.status).toBe('CANCELLED');
    expect(body.cancelReason).toBe('out_of_stock:KB-001');
    expect(body.history).toHaveLength(2);
  });

  it('cancels the order when the payment fails', async () => {
    const order = await placeOrder();
    await receive('stock.reserved', { orderId: order.id });
    await receive('payment.failed', {
      orderId: order.id,
      reason: 'card_declined',
    });

    const body = await getOrder(order.id);
    expect(body.status).toBe('CANCELLED');
    expect(body.cancelReason).toBe('card_declined');

    await outbox.publishPending();
    const cancelled = streams
      .events(STREAM)
      .find((e) => e.type === 'order.cancelled');
    expect(cancelled.data).toMatchObject({
      orderId: order.id,
      reason: 'card_declined',
    });
  });

  it('handles a redelivered event only once', async () => {
    const order = await placeOrder();
    const event = await receive('stock.reserved', { orderId: order.id });
    await streams.publish(STREAM, { event: JSON.stringify(event) });
    await consumer.poll();

    expect((await getOrder(order.id)).history).toHaveLength(2);
    expect(streams.pendingCount(STREAM, 'orders')).toBe(0);
  });

  it('moves malformed entries to the dead-letter stream', async () => {
    await streams.publish(STREAM, { event: '{nope' });
    await consumer.poll();
    expect(streams.entries(`${STREAM}:dlq`)).toHaveLength(1);
    expect(streams.pendingCount(STREAM, 'orders')).toBe(0);
  });

  it('lists orders filtered by status', async () => {
    const first = await placeOrder();
    await placeOrder();
    await receive('stock.rejected', { orderId: first.id, reason: 'x' });

    const res = await http().get('/orders?status=CANCELLED').expect(200);
    expect(res.body.map((o: any) => o.id)).toEqual([first.id]);
    expect((await http().get('/orders').expect(200)).body).toHaveLength(2);
  });

  it('returns 404 for unknown orders and 400 for bad ids', async () => {
    await http()
      .get('/orders/00000000-0000-4000-8000-000000000000')
      .expect(404);
    await http().get('/orders/abc').expect(400);
  });

  it('reports health', async () => {
    const res = await http().get('/health').expect(200);
    expect(res.body).toEqual({
      status: 'up',
      service: 'orders',
      checks: { database: 'up' },
    });
  });

  it('serves the OpenAPI document', async () => {
    const res = await http().get('/openapi.json').expect(200);
    expect(Object.keys(res.body.paths)).toContain('/orders/{id}');
  });
});
