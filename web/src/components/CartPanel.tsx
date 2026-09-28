import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { usePlaceOrder } from '../api/hooks'
import type { Product } from '../api/types'
import { money } from '../lib/format'
import { cartTotal, useCart } from '../store/cart'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function CartPanel({ products }: { products: Product[] }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { lines, email, setEmail, setQuantity, clear } = useCart()
  const [decline, setDecline] = useState(false)
  const [touched, setTouched] = useState(false)
  const place = usePlaceOrder()

  const bySku = Object.fromEntries(products.map((p) => [p.sku, p]))
  const entries = Object.entries(lines).filter(([sku]) => bySku[sku])
  const total = cartTotal(
    lines,
    Object.fromEntries(products.map((p) => [p.sku, p.price])),
  )
  const emailValid = EMAIL.test(email)
  const overStock = entries.some(([sku, q]) => q > bySku[sku].stock)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (!emailValid || entries.length === 0) return
    place.mutate(
      {
        customerEmail: email,
        items: entries.map(([sku, quantity]) => ({ sku, quantity })),
        simulatePaymentFailure: decline,
      },
      {
        onSuccess: (order) => {
          clear()
          setDecline(false)
          void navigate(`/orders/${order.id}`)
        },
      },
    )
  }

  return (
    <form onSubmit={submit} className="card sticky top-20 p-5" aria-label={t('cart.title')}>
      <h2 className="text-lg font-semibold text-white">{t('cart.title')}</h2>

      {entries.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">{t('cart.empty')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-ink-800">
          {entries.map(([sku, quantity]) => {
            const p = bySku[sku]
            return (
              <li key={sku} className="flex items-center gap-3 py-2 text-sm">
                <span aria-hidden>{p.emoji}</span>
                <span className="min-w-0 flex-1 truncate">{i18n.language === 'es' ? p.name_es : p.name_en}</span>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={quantity}
                  onChange={(e) => setQuantity(sku, Number(e.target.value))}
                  className="w-14 rounded-lg border border-ink-600 bg-ink-850 px-2 py-1 text-right"
                  aria-label={`${sku} quantity`}
                />
                <span className="w-20 text-right font-mono">{money(p.price * quantity, i18n.language)}</span>
              </li>
            )
          })}
        </ul>
      )}

      {overStock && <p className="mt-2 text-xs text-amber-300">{t('cart.overStock')}</p>}

      <label className="mt-4 block text-sm">
        <span className="text-slate-300">{t('cart.email')}</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder="ada@example.com"
          className="mt-1 w-full rounded-lg border border-ink-600 bg-ink-850 px-3 py-2 outline-none focus:border-indigo-400"
        />
        {touched && !emailValid ? (
          <span className="mt-1 block text-xs text-rose-300">{t('cart.invalidEmail')}</span>
        ) : (
          <span className="mt-1 block text-xs text-slate-500">{t('cart.emailHint')}</span>
        )}
      </label>

      <label className="mt-4 flex cursor-pointer gap-3 rounded-xl border border-ink-700 p-3 text-sm">
        <input
          type="checkbox"
          checked={decline}
          onChange={(e) => setDecline(e.target.checked)}
          className="mt-0.5 size-4 accent-rose-400"
        />
        <span>
          <span className="block text-slate-200">{t('cart.decline')}</span>
          <span className="block text-xs text-slate-500">{t('cart.declineHint')}</span>
        </span>
      </label>

      <div className="mt-5 flex items-center justify-between">
        <span className="text-slate-400">{t('cart.total')}</span>
        <span className="text-xl font-semibold text-white">{money(total, i18n.language)}</span>
      </div>

      {place.isError && <p className="mt-3 text-sm text-rose-300">{place.error.message}</p>}

      <div className="mt-4 flex gap-2">
        <button type="submit" className="btn btn-primary flex-1" disabled={entries.length === 0 || place.isPending}>
          {place.isPending ? t('cart.placing') : t('cart.place')}
        </button>
        {entries.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={clear}>
            {t('cart.clear')}
          </button>
        )}
      </div>
    </form>
  )
}
