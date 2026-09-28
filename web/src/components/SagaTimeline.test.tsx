import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import i18n from '../i18n'
import type { SagaStep } from '../lib/saga'
import { SagaTimeline } from './SagaTimeline'
import { StatusBadge } from './StatusBadge'

describe('SagaTimeline', () => {
  beforeEach(() => i18n.changeLanguage('en'))

  it('renders every step with its state and the compensation note', () => {
    const steps: SagaStep[] = [
      { key: 'placed', state: 'done', label: 'placed', service: 'orders' },
      { key: 'stock', state: 'done', label: 'stock', service: 'inventory' },
      { key: 'payment', state: 'failed', label: 'paymentFailed', service: 'payments', detail: 'card_declined', compensated: true },
      { key: 'outcome', state: 'failed', label: 'cancelled', service: 'orders' },
    ]
    const { container } = render(<SagaTimeline steps={steps} />)

    expect(screen.getByText('Payment declined')).toBeInTheDocument()
    expect(screen.getByText('card declined')).toBeInTheDocument()
    expect(screen.getByText(/Reserved stock released/)).toBeInTheDocument()
    expect([...container.querySelectorAll('li')].map((li) => li.dataset.state)).toEqual([
      'done',
      'done',
      'failed',
      'failed',
    ])
  })

  it('shows the translated order status', async () => {
    await i18n.changeLanguage('es')
    render(<StatusBadge status="STOCK_RESERVED" />)
    expect(screen.getByText('Stock reservado')).toBeInTheDocument()
  })
})
