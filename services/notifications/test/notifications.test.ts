import { emailBody, toNotification } from '../src/notifications.js';
import { event } from './fixtures.js';

describe('toNotification', () => {
  it('turns intermediate events into feed items', () => {
    const e = event('stock.reserved', { items: [] });
    expect(toNotification(e)).toEqual({
      id: e.id,
      type: 'stock.reserved',
      source: 'inventory',
      orderId: 'order-1',
      occurredAt: e.occurredAt,
      channel: 'feed',
      recipient: null,
      data: e.data,
    });
  });

  it('emails the customer when the order is confirmed or cancelled', () => {
    const n = toNotification(
      event('order.cancelled', {
        customerEmail: 'ada@example.com',
        reason: 'x',
      }),
    );
    expect(n.channel).toBe('email');
    expect(n.recipient).toBe('ada@example.com');
  });

  it('does not expose the email on non-email events', () => {
    const n = toNotification(
      event('order.created', { customerEmail: 'ada@example.com' }),
    );
    expect(n.recipient).toBeNull();
    expect(n.channel).toBe('feed');
  });

  it('writes a readable email body', () => {
    const confirmed = toNotification(
      event(
        'order.confirmed',
        { customerEmail: 'a@b.co', total: 42 },
        'abcdef123456',
      ),
    );
    expect(emailBody(confirmed)).toBe(
      'Your order abcdef12 is confirmed. Total: 42 USD.',
    );
    const cancelled = toNotification(
      event('order.cancelled', {
        customerEmail: 'a@b.co',
        reason: 'card_declined',
      }),
    );
    expect(emailBody(cancelled)).toContain('cancelled (card_declined)');
  });
});
