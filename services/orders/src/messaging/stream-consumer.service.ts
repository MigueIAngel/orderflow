import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { TransactionRunner } from '../database/transaction-runner.js';
import { EventEnvelope, EventType, parseEvent } from './event.js';
import { ProcessedEvent } from './messaging.entities.js';
import { MessagingSettings } from './messaging.settings.js';
import { sleep } from './outbox.service.js';
import { StreamEntry, StreamsClient } from './streams.client.js';

export type EventHandler = (
  manager: EntityManager,
  event: EventEnvelope,
) => Promise<void>;

/**
 * Reads the shared stream through this service's consumer group. Each event is handled in
 * one transaction together with its `processed_events` row, so redeliveries are no-ops.
 * Failures stay pending and are retried; after `maxAttempts` they go to the dead-letter stream.
 */
@Injectable()
export class StreamConsumer implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(StreamConsumer.name);
  private readonly handlers = new Map<EventType, EventHandler>();
  private readonly attempts = new Map<string, number>();
  private running = false;
  private loop?: Promise<void>;

  constructor(
    private readonly tx: TransactionRunner,
    private readonly streams: StreamsClient,
    private readonly settings: MessagingSettings,
  ) {}

  on(type: EventType, handler: EventHandler) {
    this.handlers.set(type, handler);
  }

  get deadLetterStream() {
    return `${this.settings.stream}:dlq`;
  }

  async poll(pending = false, blockMs = 2000): Promise<number> {
    const entries = await this.streams.readGroup(
      this.settings.stream,
      this.settings.group,
      this.settings.consumer,
      { pending, blockMs },
    );
    for (const entry of entries) await this.process(entry);
    return entries.length;
  }

  async process({ id, fields }: StreamEntry): Promise<void> {
    let event: EventEnvelope;
    try {
      event = parseEvent(fields.event);
    } catch {
      this.logger.error(`malformed entry ${id}, moving to dead letters`);
      return this.deadLetter(id, fields, 'malformed');
    }

    const handler = this.handlers.get(event.type);
    if (!handler) return this.ack(id);

    if (this.settings.processingDelayMs > 0) {
      await sleep(this.settings.processingDelayMs);
    }
    try {
      await this.tx.run(async (manager) => {
        const seen = await manager.findOneBy(ProcessedEvent, {
          eventId: event.id,
        });
        if (seen) return;
        await manager.insert(ProcessedEvent, {
          eventId: event.id,
          eventType: event.type,
        });
        await handler(manager, event);
        this.logger.log(`handled ${event.type} for ${event.correlationId}`);
      });
    } catch (error) {
      const attempt = (this.attempts.get(id) ?? 0) + 1;
      this.attempts.set(id, attempt);
      this.logger.error(
        `${event.type} failed (attempt ${attempt}): ${String(error)}`,
      );
      if (attempt >= this.settings.maxAttempts) {
        await this.deadLetter(id, fields, 'max attempts reached');
      }
      return;
    }
    await this.ack(id);
  }

  onApplicationBootstrap() {
    if (!this.settings.enabled) return;
    this.running = true;
    this.loop = this.run();
  }

  async onModuleDestroy() {
    this.running = false;
    await this.loop;
  }

  private async run() {
    try {
      await this.streams.ensureGroup(this.settings.stream, this.settings.group);
      await this.poll(true);
    } catch (error) {
      this.logger.error(`consumer startup failed: ${String(error)}`);
    }
    while (this.running) {
      try {
        await this.streams.ensureGroup(
          this.settings.stream,
          this.settings.group,
        );
        await this.poll();
        if (this.attempts.size > 0) {
          await sleep(1000);
          await this.poll(true);
        }
      } catch (error) {
        this.logger.error(`consumer loop error: ${String(error)}`);
        await sleep(2000);
      }
    }
  }

  private async ack(id: string) {
    this.attempts.delete(id);
    await this.streams.ack(this.settings.stream, this.settings.group, id);
  }

  private async deadLetter(
    id: string,
    fields: Record<string, string>,
    reason: string,
  ) {
    await this.streams.publish(this.deadLetterStream, {
      ...fields,
      reason,
      group: this.settings.group,
    });
    await this.ack(id);
  }
}
