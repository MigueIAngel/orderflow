import { describe, expect, it } from 'vitest'
import i18n from '../i18n'
import type { Notification } from '../api/types'
import { describeEvent, reasonText } from './describe'

const n = (type: string, data: Record<string, unknown>) =>
  ({ id: '1', type, source: 'orders', orderId: 'o', occurredAt: '', channel: 'feed', recipient: null, data }) as Notification

describe('describeEvent', () => {
  it('describes events in English', async () => {
    await i18n.changeLanguage('en')
    expect(describeEvent(n('payment.succeeded', { amount: 89 }), i18n.t, 'en')).toBe('Payment of $89.00 captured')
    expect(describeEvent(n('stock.rejected', { reason: 'out_of_stock', sku: 'LP-008' }), i18n.t, 'en')).toBe(
      'Stock rejected: out of stock (LP-008)',
    )
  })

  it('describes events in Spanish', async () => {
    await i18n.changeLanguage('es')
    expect(describeEvent(n('order.cancelled', { reason: 'card_declined' }), i18n.t, 'es')).toBe(
      'Orden cancelada: tarjeta rechazada',
    )
    expect(describeEvent(n('stock.released', {}), i18n.t, 'es')).toBe('Stock reservado liberado (compensación)')
  })

  it('falls back to the raw values for unknown codes', async () => {
    await i18n.changeLanguage('en')
    expect(reasonText('mystery', i18n.t)).toBe('mystery')
    expect(describeEvent(n('something.new', {}), i18n.t, 'en')).toBe('something.new')
  })
})
