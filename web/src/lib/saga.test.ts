import { describe, expect, it } from 'vitest'
import type { Notification, Order, StatusChange } from '../api/types'
import { sagaSteps } from './saga'

const change = (event: string | null, status: StatusChange['status'], note: string | null = null): StatusChange => ({
  id: Math.random(),
  status,
  event,
  note,
  at: '2026-09-28T03:00:00.000Z',
})

const order = (status: Order['status'], history: StatusChange[], cancelReason: string | null = null): Order => ({
  id: 'o-1',
  customerEmail: 'ada@example.com',
  total: 10,
  currency: 'USD',
  status,
  cancelReason,
  simulatePaymentFailure: false,
  items: [],
  history,
  createdAt: '2026-09-28T03:00:00.000Z',
  updatedAt: '2026-09-28T03:00:00.000Z',
})

const states = (o: Order, notifications: Notification[] = []) =>
  sagaSteps({ order: o, notifications }).map((s) => `${s.key}:${s.state}`)

describe('sagaSteps', () => {
  it('waits for inventory right after the order is placed', () => {
    expect(states(order('PENDING', [change(null, 'PENDING')]))).toEqual([
      'placed:done',
      'stock:current',
      'payment:pending',
      'outcome:pending',
    ])
  })

  it('shows a confirmed happy path', () => {
    const o = order('CONFIRMED', [
      change(null, 'PENDING'),
      change('stock.reserved', 'STOCK_RESERVED'),
      change('payment.succeeded', 'CONFIRMED'),
    ])
    expect(states(o)).toEqual(['placed:done', 'stock:done', 'payment:done', 'outcome:done'])
  })

  it('skips the payment when stock is rejected', () => {
    const o = order(
      'CANCELLED',
      [change(null, 'PENDING'), change('stock.rejected', 'CANCELLED', 'out_of_stock:LP-008')],
      'out_of_stock:LP-008',
    )
    const steps = sagaSteps({ order: o, notifications: [] })
    expect(steps.map((s) => s.state)).toEqual(['done', 'failed', 'skipped', 'failed'])
    expect(steps[1].detail).toBe('out_of_stock:LP-008')
  })

  it('marks the compensation when stock was released after a declined payment', () => {
    const o = order(
      'CANCELLED',
      [
        change(null, 'PENDING'),
        change('stock.reserved', 'STOCK_RESERVED'),
        change('payment.failed', 'CANCELLED', 'card_declined'),
      ],
      'card_declined',
    )
    const released = { type: 'stock.released' } as Notification
    const payment = sagaSteps({ order: o, notifications: [released] })[2]
    expect(payment).toMatchObject({ state: 'failed', label: 'paymentFailed', compensated: true })
  })
})
