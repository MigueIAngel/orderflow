import { buildEvent, parseEvent } from './event.js';

describe('event envelope', () => {
  it('builds a complete envelope', () => {
    const event = buildEvent('order.created', 'orders', 'o-1', { a: 1 });
    expect(event.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(new Date(event.occurredAt).toISOString()).toBe(event.occurredAt);
    expect(event).toMatchObject({
      type: 'order.created',
      source: 'orders',
      correlationId: 'o-1',
      data: { a: 1 },
    });
  });

  it('round-trips through JSON', () => {
    const event = buildEvent('stock.reserved', 'inventory', 'o-2', {});
    expect(parseEvent(JSON.stringify(event))).toEqual(event);
  });

  it('rejects envelopes without required fields', () => {
    expect(() => parseEvent('{"type":"order.created"}')).toThrow(/missing/);
  });
});
