import type { Redis } from 'ioredis';
import type { FastifyBaseLogger } from 'fastify';
import type { NotificationHub } from './hub.js';
import {
  emailBody,
  toNotification,
  type EventEnvelope,
} from './notifications.js';
import type { NotificationStore } from './store.js';

type XReadGroupReply = [string, [string, string[]][]][] | null;

export interface ConsumerOptions {
  stream: string;
  group: string;
  consumer: string;
}

/**
 * Reads every event through the `notifications` consumer group, stores it and pushes it to
 * the SSE hub. The service keeps no database: Redis holds both the stream and the feed.
 */
export class EventConsumer {
  private running = false;
  private loop?: Promise<void>;

  constructor(
    private readonly redis: Redis,
    private readonly store: NotificationStore,
    private readonly hub: NotificationHub,
    private readonly options: ConsumerOptions,
    private readonly log: FastifyBaseLogger,
  ) {}

  async handle(raw: string | undefined) {
    let event: EventEnvelope;
    try {
      event = JSON.parse(raw ?? '') as EventEnvelope;
      if (!event.id || !event.type) throw new Error('incomplete envelope');
    } catch {
      this.log.warn('skipping malformed event');
      return;
    }
    const notification = toNotification(event);
    if (!(await this.store.add(notification))) return;
    if (notification.channel === 'email') {
      this.log.info(
        { to: notification.recipient },
        `email sent: ${emailBody(notification)}`,
      );
    }
    this.hub.publish(notification);
  }

  async poll(id: '0' | '>' = '>', blockMs = 2000) {
    const { stream, group, consumer } = this.options;
    const args: (string | number)[] = ['GROUP', group, consumer, 'COUNT', 50];
    if (id === '>') args.push('BLOCK', blockMs);
    args.push('STREAMS', stream, id);
    const reply = (await this.redis.call(
      'XREADGROUP',
      ...args,
    )) as XReadGroupReply;
    for (const [, entries] of reply ?? []) {
      for (const [entryId, flat] of entries) {
        const fields = flat ?? [];
        await this.handle(fields[fields.indexOf('event') + 1]);
        await this.redis.call('XACK', stream, group, entryId);
      }
    }
  }

  async ensureGroup() {
    try {
      await this.redis.call(
        'XGROUP',
        'CREATE',
        this.options.stream,
        this.options.group,
        '0',
        'MKSTREAM',
      );
    } catch (error) {
      if (!String(error).includes('BUSYGROUP')) throw error;
    }
  }

  start() {
    this.running = true;
    this.loop = (async () => {
      let recovered = false;
      while (this.running) {
        try {
          await this.ensureGroup();
          if (!recovered) {
            await this.poll('0');
            recovered = true;
          }
          await this.poll('>');
        } catch (error) {
          this.log.error({ err: error }, 'consumer loop error');
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    })();
  }

  async stop() {
    this.running = false;
    await this.loop;
  }
}
