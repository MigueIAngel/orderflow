import { hostname } from 'node:os';

export interface Config {
  port: number;
  redisUrl: string;
  stream: string;
  group: string;
  consumer: string;
  listKey: string;
  maxNotifications: number;
}

export function loadConfig(env = process.env): Config {
  return {
    port: Number(env.PORT ?? 3002),
    redisUrl: env.REDIS_URL ?? 'redis://localhost:6379/0',
    stream: env.EVENTS_STREAM ?? 'orderflow:events',
    group: env.CONSUMER_GROUP ?? 'notifications',
    consumer: env.CONSUMER_NAME ?? hostname(),
    listKey: env.NOTIFICATIONS_KEY ?? 'orderflow:notifications',
    maxNotifications: Number(env.MAX_NOTIFICATIONS ?? 200),
  };
}
