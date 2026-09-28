import { Redis } from 'ioredis';
import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { EventConsumer } from './consumer.js';
import { NotificationHub } from './hub.js';
import { RedisNotificationStore } from './store.js';

const config = loadConfig();
// RESP2 keeps XREADGROUP replies as nested arrays.
const redis = new Redis(config.redisUrl, { protocol: 2 });
const reader = new Redis(config.redisUrl, { protocol: 2 });
const hub = new NotificationHub();
const store = new RedisNotificationStore(
  redis,
  config.listKey,
  config.maxNotifications,
);

const app = await buildApp(
  {
    store,
    hub,
    checks: { redis: async () => (await redis.ping()) === 'PONG' },
  },
  { logger: { level: process.env.LOG_LEVEL ?? 'info' } },
);

const consumer = new EventConsumer(
  reader,
  store,
  hub,
  { stream: config.stream, group: config.group, consumer: config.consumer },
  app.log,
);

const shutdown = async () => {
  await consumer.stop();
  await app.close();
  reader.disconnect();
  await redis.quit();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: config.port, host: '0.0.0.0' });
consumer.start();
