import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { NotificationHub } from '../src/hub.js';
import { toNotification } from '../src/notifications.js';
import { InMemoryNotificationStore } from '../src/store.js';
import { event } from './fixtures.js';

describe('HTTP API', () => {
  let app: FastifyInstance;
  let store: InMemoryNotificationStore;
  let hub: NotificationHub;

  beforeEach(async () => {
    store = new InMemoryNotificationStore();
    hub = new NotificationHub();
    app = await buildApp({
      store,
      hub,
      checks: { redis: async () => true },
      heartbeatMs: 50,
    });
  });

  afterEach(() => app.close());

  it('lists notifications newest first and filters by order', async () => {
    await store.add(toNotification(event('order.created', {}, 'a')));
    await store.add(toNotification(event('order.created', {}, 'b')));

    const all = await app.inject('/notifications');
    expect(all.json().map((n: { orderId: string }) => n.orderId)).toEqual([
      'b',
      'a',
    ]);
    const one = await app.inject('/notifications?orderId=a');
    expect(one.json()).toHaveLength(1);
  });

  it('validates the limit', async () => {
    const res = await app.inject('/notifications?limit=0');
    expect(res.statusCode).toBe(400);
  });

  it('reports health with the number of live subscribers', async () => {
    const res = await app.inject('/health');
    expect(res.json()).toEqual({
      status: 'up',
      service: 'notifications',
      checks: { redis: 'up' },
      subscribers: 0,
    });
  });

  it('reports degraded when a dependency is down', async () => {
    const degraded = await buildApp({
      store,
      hub,
      checks: { redis: async () => false },
    });
    expect((await degraded.inject('/health')).json().status).toBe('degraded');
    await degraded.close();
  });

  it('streams notifications as Server-Sent Events', async () => {
    const url = await app.listen({ port: 0, host: '127.0.0.1' });
    const controller = new AbortController();
    const response = await fetch(`${url}/notifications/stream`, {
      signal: controller.signal,
    });
    expect(response.headers.get('content-type')).toBe('text/event-stream');

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let text = decoder.decode((await reader.read()).value);
    expect(text).toContain(': connected');

    await vi.waitFor(() => expect(hub.subscribers).toBe(1));
    const n = toNotification(event('order.confirmed', { total: 10 }));
    hub.publish(n);
    while (!text.includes('event: notification')) {
      text += decoder.decode((await reader.read()).value);
    }
    expect(text).toContain(`id: ${n.id}`);
    expect(text).toContain('"type":"order.confirmed"');

    controller.abort();
    await vi.waitFor(() => expect(hub.subscribers).toBe(0));
  });

  it('serves the OpenAPI document', async () => {
    const res = await app.inject('/openapi.json');
    expect(Object.keys(res.json().paths)).toContain('/notifications/stream');
  });
});
