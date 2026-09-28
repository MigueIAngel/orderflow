import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Runs work inside a database transaction.
 *
 * SQLite (used by the tests and the single-container demo) has one connection, so
 * transactions coming from HTTP requests, the consumer and the outbox relay are queued
 * instead of interleaved. PostgreSQL runs them concurrently.
 */
@Injectable()
export class TransactionRunner {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    if (this.dataSource.options.type !== 'better-sqlite3') {
      return this.dataSource.transaction(work);
    }
    const next = this.queue.then(() => this.dataSource.transaction(work));
    this.queue = next.catch(() => undefined);
    return next;
  }
}
