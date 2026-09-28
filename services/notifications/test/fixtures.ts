import { randomUUID } from 'node:crypto';
import type { EventEnvelope } from '../src/notifications.js';

export function event(
  type: string,
  data: Record<string, unknown> = {},
  orderId = 'order-1',
): EventEnvelope {
  return {
    id: randomUUID(),
    type,
    source: type.split('.')[0] === 'stock' ? 'inventory' : 'orders',
    occurredAt: new Date().toISOString(),
    correlationId: orderId,
    data: { orderId, ...data },
  };
}

export const silentLog = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
} as never;
