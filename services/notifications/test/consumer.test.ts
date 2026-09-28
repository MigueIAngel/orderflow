import type { Redis } from 'ioredis';
import { EventConsumer } from '../src/consumer.js';
import { NotificationHub } from '../src/hub.js';
import { InMemoryNotificationStore } from '../src/store.js';
import { event, silentLog } from './fixtures.js';

function setup() {
  const store = new InMemoryNotificationStore();
  const hub = new NotificationHub();
  const received: string[] = [];
  hub.subscribe((n) => received.push(n.type));
  const consumer = new EventConsumer(
    {} as Redis,
    store,
    hub,
    { stream: 's', group: 'g', consumer: 'c' },
    silentLog,
  );
  return { store, consumer, received };
}

describe('EventConsumer.handle', () => {
  it('stores the notification and pushes it to subscribers', async () => {
    const { store, consumer, received } = setup();
    await consumer.handle(JSON.stringify(event('payment.succeeded')));
    expect(store.items).toHaveLength(1);
    expect(received).toEqual(['payment.succeeded']);
  });

  it('ignores redelivered events', async () => {
    const { store, consumer, received } = setup();
    const raw = JSON.stringify(event('order.created'));
    await consumer.handle(raw);
    await consumer.handle(raw);
    expect(store.items).toHaveLength(1);
    expect(received).toHaveLength(1);
  });

  it.each([undefined, 'not json', '{"type":"x"}'])(
    'skips malformed payload %s',
    async (raw) => {
      const { store, consumer } = setup();
      await consumer.handle(raw);
      expect(store.items).toHaveLength(0);
    },
  );
});
