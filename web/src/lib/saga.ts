import type { Notification, OrderSummary } from '../api/types'

export type StepState = 'done' | 'failed' | 'current' | 'pending' | 'skipped'

export interface SagaStep {
  key: 'placed' | 'stock' | 'payment' | 'outcome'
  state: StepState
  /** Translation key under `order.steps`. */
  label: string
  service: string
  at?: string
  detail?: string
  compensated?: boolean
}

/** Turns an order summary into the four visible steps of the saga. */
export function sagaSteps({ order, notifications }: Pick<OrderSummary, 'order' | 'notifications'>): SagaStep[] {
  const history = order.history ?? []
  const event = (type: string) => history.find((h) => h.event === type)
  const seen = (type: string): Notification | undefined => notifications.find((n) => n.type === type)
  const cancelled = order.status === 'CANCELLED'

  const reserved = event('stock.reserved')
  const rejected = event('stock.rejected')
  const paid = event('payment.succeeded')
  const declined = event('payment.failed')

  const stock: SagaStep = reserved
    ? { key: 'stock', state: 'done', label: 'stock', service: 'inventory', at: reserved.at }
    : rejected
      ? { key: 'stock', state: 'failed', label: 'stockRejected', service: 'inventory', at: rejected.at, detail: rejected.note ?? undefined }
      : { key: 'stock', state: cancelled ? 'skipped' : 'current', label: 'stock', service: 'inventory' }

  const payment: SagaStep = paid
    ? { key: 'payment', state: 'done', label: 'payment', service: 'payments', at: paid.at }
    : declined
      ? {
          key: 'payment',
          state: 'failed',
          label: 'paymentFailed',
          service: 'payments',
          at: declined.at,
          detail: declined.note ?? undefined,
          compensated: Boolean(seen('stock.released')),
        }
      : {
          key: 'payment',
          state: stock.state === 'failed' || cancelled ? 'skipped' : stock.state === 'done' ? 'current' : 'pending',
          label: 'payment',
          service: 'payments',
        }

  const outcome: SagaStep =
    order.status === 'CONFIRMED'
      ? { key: 'outcome', state: 'done', label: 'confirmed', service: 'orders', at: paid?.at }
      : cancelled
        ? { key: 'outcome', state: 'failed', label: 'cancelled', service: 'orders', at: history.at(-1)?.at, detail: order.cancelReason ?? undefined }
        : { key: 'outcome', state: 'pending', label: 'confirmed', service: 'orders' }

  return [
    { key: 'placed', state: 'done', label: 'placed', service: 'orders', at: history[0]?.at ?? order.createdAt },
    stock,
    payment,
    outcome,
  ]
}
