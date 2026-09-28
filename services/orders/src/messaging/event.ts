import { randomUUID } from 'node:crypto';

export type EventType =
  | 'order.created'
  | 'order.confirmed'
  | 'order.cancelled'
  | 'stock.reserved'
  | 'stock.rejected'
  | 'stock.released'
  | 'payment.succeeded'
  | 'payment.failed';

/** Wire format shared by every service. See contracts/README.md. */
export interface EventEnvelope<T = Record<string, unknown>> {
  id: string;
  type: EventType;
  source: string;
  occurredAt: string;
  correlationId: string;
  data: T;
}

export function buildEvent<T>(
  type: EventType,
  source: string,
  correlationId: string,
  data: T,
): EventEnvelope<T> {
  return {
    id: randomUUID(),
    type,
    source,
    occurredAt: new Date().toISOString(),
    correlationId,
    data,
  };
}

export function parseEvent(raw: string): EventEnvelope {
  const event = JSON.parse(raw) as EventEnvelope;
  for (const field of ['id', 'type', 'correlationId', 'data'] as const) {
    if (event[field] === undefined) {
      throw new Error(`event is missing "${field}"`);
    }
  }
  return event;
}
