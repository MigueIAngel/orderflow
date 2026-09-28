export interface EventEnvelope {
  id: string;
  type: string;
  source: string;
  occurredAt: string;
  correlationId: string;
  data: Record<string, unknown>;
}

export type Channel = 'feed' | 'email';

/**
 * What the UI shows. The text is not stored here: the frontend translates `type` into
 * English or Spanish and uses `data` for the details.
 */
export interface Notification {
  id: string;
  type: string;
  source: string;
  orderId: string;
  occurredAt: string;
  channel: Channel;
  recipient: string | null;
  data: Record<string, unknown>;
}

/** Events the customer gets an (simulated) email for. */
const EMAIL_EVENTS = new Set(['order.confirmed', 'order.cancelled']);

export function toNotification(event: EventEnvelope): Notification {
  const email = EMAIL_EVENTS.has(event.type);
  const recipient =
    typeof event.data.customerEmail === 'string'
      ? event.data.customerEmail
      : null;
  return {
    id: event.id,
    type: event.type,
    source: event.source,
    orderId: event.correlationId,
    occurredAt: event.occurredAt,
    channel: email && recipient ? 'email' : 'feed',
    recipient: email ? recipient : null,
    data: event.data,
  };
}

/** Plain-text body of the simulated customer email. */
export function emailBody(n: Notification): string {
  const order = n.orderId.slice(0, 8);
  if (n.type === 'order.confirmed') {
    return `Your order ${order} is confirmed. Total: ${n.data.total} USD.`;
  }
  return `Your order ${order} was cancelled (${n.data.reason}). You have not been charged.`;
}
