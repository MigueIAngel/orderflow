import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyServerOptions } from 'fastify';
import type { NotificationHub } from './hub.js';
import type { Notification } from './notifications.js';
import type { NotificationStore } from './store.js';

export interface AppDeps {
  store: NotificationStore;
  hub: NotificationHub;
  /** Extra health checks, e.g. Redis. */
  checks?: Record<string, () => Promise<boolean>>;
  heartbeatMs?: number;
}

const notificationSchema = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    type: { type: 'string' },
    source: { type: 'string' },
    orderId: { type: 'string' },
    occurredAt: { type: 'string' },
    channel: { type: 'string', enum: ['feed', 'email'] },
    recipient: { type: ['string', 'null'] },
    data: { type: 'object', additionalProperties: true },
  },
} as const;

export async function buildApp(
  { store, hub, checks = {}, heartbeatMs = 15_000 }: AppDeps,
  options: FastifyServerOptions = {},
) {
  const app = Fastify(options);
  await app.register(cors);
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'OrderFlow · Notifications service',
        description:
          'Customer notifications built from saga events, plus a live Server-Sent Events feed.',
        version: '1.0.0',
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs' });

  app.get('/openapi.json', { schema: { hide: true } }, async () =>
    app.swagger(),
  );

  app.get<{ Querystring: { orderId?: string; limit?: number } }>(
    '/notifications',
    {
      schema: {
        tags: ['notifications'],
        summary: 'Latest notifications, newest first',
        querystring: {
          type: 'object',
          properties: {
            orderId: { type: 'string' },
            limit: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
          },
        },
        response: { 200: { type: 'array', items: notificationSchema } },
      },
    },
    async (request) => store.list(request.query),
  );

  app.get(
    '/notifications/stream',
    {
      schema: {
        tags: ['notifications'],
        summary:
          'Live feed (text/event-stream), one `notification` event per saga event',
      },
    },
    (request, reply) => {
      reply.hijack();
      const res = reply.raw;
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(`retry: 3000\n: connected\n\n`);
      const send = (n: Notification) =>
        res.write(
          `id: ${n.id}\nevent: notification\ndata: ${JSON.stringify(n)}\n\n`,
        );
      const unsubscribe = hub.subscribe(send);
      const heartbeat = setInterval(() => res.write(': ping\n\n'), heartbeatMs);
      request.raw.on('close', () => {
        clearInterval(heartbeat);
        unsubscribe();
      });
    },
  );

  app.get('/health', { schema: { tags: ['health'] } }, async () => {
    const results: Record<string, 'up' | 'down'> = {};
    for (const [name, check] of Object.entries(checks)) {
      results[name] = (await check().catch(() => false)) ? 'up' : 'down';
    }
    const status = Object.values(results).every((r) => r === 'up')
      ? 'up'
      : 'degraded';
    return {
      status,
      service: 'notifications',
      checks: results,
      subscribers: hub.subscribers,
    };
  });

  return app;
}
