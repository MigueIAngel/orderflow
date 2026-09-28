import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EntityManager, IsNull } from 'typeorm';
import { TransactionRunner } from '../database/transaction-runner.js';
import { buildEvent, EventEnvelope, EventType } from './event.js';
import { OutboxMessage } from './messaging.entities.js';
import { MessagingSettings } from './messaging.settings.js';
import { StreamsClient } from './streams.client.js';

export const SOURCE = 'orders';

@Injectable()
export class OutboxService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private running = false;
  private loop?: Promise<void>;

  constructor(
    private readonly tx: TransactionRunner,
    private readonly streams: StreamsClient,
    private readonly settings: MessagingSettings,
  ) {}

  /** Stage an event; it is only published if the caller's transaction commits. */
  async add<T>(
    manager: EntityManager,
    type: EventType,
    correlationId: string,
    data: T,
  ): Promise<EventEnvelope<T>> {
    const event = buildEvent(type, SOURCE, correlationId, data);
    await manager.insert(OutboxMessage, {
      eventId: event.id,
      eventType: type,
      payload: JSON.stringify(event),
      publishedAt: null,
    });
    return event;
  }

  /** Publish unsent rows in insertion order. Returns how many were sent. */
  publishPending(batchSize = 100): Promise<number> {
    return this.tx.run(async (manager) => {
      const rows = await manager.find(OutboxMessage, {
        where: { publishedAt: IsNull() },
        order: { id: 'ASC' },
        take: batchSize,
      });
      for (const row of rows) {
        await this.streams.publish(this.settings.stream, {
          event: row.payload,
        });
        await manager.update(OutboxMessage, row.id, {
          publishedAt: new Date(),
        });
      }
      return rows.length;
    });
  }

  onApplicationBootstrap() {
    if (!this.settings.enabled) return;
    this.running = true;
    this.loop = this.relay();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loop;
  }

  private async relay() {
    while (this.running) {
      try {
        const published = await this.publishPending();
        if (published > 0) {
          this.logger.log(`published ${published} event(s)`);
          continue;
        }
      } catch (error) {
        this.logger.error(`relay failed: ${String(error)}`);
      }
      await sleep(250);
    }
  }
}

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));
