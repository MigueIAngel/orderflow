import type { Redis } from 'ioredis';
import type { Notification } from './notifications.js';

export interface NotificationStore {
  /** Returns false when the notification was already stored (duplicate event). */
  add(notification: Notification): Promise<boolean>;
  list(options?: { orderId?: string; limit?: number }): Promise<Notification[]>;
}

/** Keeps the latest notifications in a capped Redis list; dedupes by event id. */
export class RedisNotificationStore implements NotificationStore {
  constructor(
    private readonly redis: Redis,
    private readonly key: string,
    private readonly max: number,
  ) {}

  async add(notification: Notification) {
    const fresh = await this.redis.set(
      `${this.key}:seen:${notification.id}`,
      '1',
      'EX',
      60 * 60 * 24,
      'NX',
    );
    if (fresh === null) return false;
    await this.redis
      .multi()
      .lpush(this.key, JSON.stringify(notification))
      .ltrim(this.key, 0, this.max - 1)
      .exec();
    return true;
  }

  async list({
    orderId,
    limit = 50,
  }: { orderId?: string; limit?: number } = {}) {
    const raw = await this.redis.lrange(this.key, 0, this.max - 1);
    const all = raw.map((item) => JSON.parse(item) as Notification);
    return (orderId ? all.filter((n) => n.orderId === orderId) : all).slice(
      0,
      limit,
    );
  }
}

export class InMemoryNotificationStore implements NotificationStore {
  readonly items: Notification[] = [];

  async add(notification: Notification) {
    if (this.items.some((n) => n.id === notification.id)) return false;
    this.items.unshift(notification);
    return true;
  }

  async list({
    orderId,
    limit = 50,
  }: { orderId?: string; limit?: number } = {}) {
    return this.items
      .filter((n) => !orderId || n.orderId === orderId)
      .slice(0, limit);
  }
}
