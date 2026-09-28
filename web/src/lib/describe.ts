import type { TFunction } from 'i18next'
import type { Notification } from '../api/types'
import { money } from './format'

/** "out_of_stock:WC-005" → "out of stock (WC-005)" in the current language. */
export function reasonText(raw: unknown, t: TFunction): string {
  if (typeof raw !== 'string' || !raw) return ''
  const [code, detail] = raw.split(':')
  const text = t(`reason.${code}`, { defaultValue: code })
  return detail && detail !== 'undefined' ? `${text} (${detail})` : text
}

/** Human sentence for a saga event, e.g. "Payment of $89.00 captured". */
export function describeEvent(n: Notification, t: TFunction, lang: string): string {
  const d = n.data
  const reason = [d.reason, d.sku].filter(Boolean).join(':')
  return t(`event.${n.type.replace('.', '_')}`, {
    defaultValue: n.type,
    total: typeof d.total === 'number' ? money(d.total, lang) : '',
    amount: typeof d.amount === 'number' ? money(d.amount, lang) : '',
    reason: reasonText(n.type === 'stock.rejected' ? reason : d.reason, t),
  })
}
