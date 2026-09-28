import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useOrderSummary } from '../api/hooks'
import { EventRow } from '../components/EventRow'
import { SagaTimeline } from '../components/SagaTimeline'
import { ServiceTag } from '../components/ServiceTag'
import { StatusBadge } from '../components/StatusBadge'
import { reasonText } from '../lib/describe'
import { dateTime, money, shortId } from '../lib/format'
import { sagaSteps } from '../lib/saga'
import { useFeed } from '../store/feed'

export function OrderDetailPage() {
  const { id = '' } = useParams()
  const { t, i18n } = useTranslation()
  const { data, isPending, error } = useOrderSummary(id)
  // Live events for this order arrive before the summary is refetched.
  const feed = useFeed((s) => s.live)
  const live = useMemo(() => feed.filter((n) => n.orderId === id), [feed, id])

  if (isPending) return <p className="text-slate-400">{t('common.loading')}</p>
  if (error || !data) {
    const notFound = error instanceof ApiError && (error.status === 404 || error.status === 400)
    return (
      <div className="card p-6">
        <p className="text-rose-300">{notFound ? t('order.notFound') : error?.message}</p>
        <Link to="/orders" className="btn btn-ghost mt-4">← {t('order.back')}</Link>
      </div>
    )
  }

  const { order, payment, reservations, unavailable } = data
  const notifications = [...live, ...data.notifications.filter((n) => !live.some((l) => l.id === n.id))]

  return (
    <>
      <Link to="/orders" className="text-sm text-slate-400 hover:text-white">← {t('order.back')}</Link>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-2xl font-bold text-white">{t('order.title', { id: `#${shortId(order.id)}` })}</h1>
        <StatusBadge status={order.status} />
        {order.simulatePaymentFailure && (
          <span className="rounded-full bg-rose-500/10 px-2.5 py-1 text-xs text-rose-300">{t('order.decline')}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-400">
        {order.customerEmail} · {dateTime(order.createdAt, i18n.language)}
      </p>

      {unavailable.length > 0 && (
        <p className="card mt-4 border-amber-400/40 bg-amber-400/10 p-3 text-sm text-amber-200">
          {t('order.unavailable', { services: unavailable.join(', ') })}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1fr]">
        <section className="card p-5">
          <h2 className="mb-5 font-semibold text-white">{t('order.saga')}</h2>
          <SagaTimeline steps={sagaSteps({ order, notifications })} />
        </section>

        <div className="grid content-start gap-6">
          <section className="card p-5">
            <h2 className="font-semibold text-white">{t('order.items')}</h2>
            <ul className="mt-3 divide-y divide-ink-800 text-sm">
              {order.items.map((item) => (
                <li key={item.id} className="flex justify-between gap-3 py-2">
                  <span>
                    {item.quantity} × {item.name} <span className="font-mono text-xs text-slate-500">{item.sku}</span>
                  </span>
                  <span className="font-mono">{money(item.unitPrice * item.quantity, i18n.language)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex justify-between border-t border-ink-800 pt-3 font-semibold">
              <span>{t('cart.total')}</span>
              <span>{money(order.total, i18n.language)}</span>
            </p>
          </section>

          <section className="card grid gap-4 p-5 sm:grid-cols-2">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                {t('order.payment')} <ServiceTag service="payments" />
              </h2>
              {payment ? (
                <p className="mt-2 text-sm">
                  <span className="font-mono">{payment.status}</span>
                  {payment.failure_reason && (
                    <span className="block text-rose-300">{reasonText(payment.failure_reason, t)}</span>
                  )}
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">{t('order.noPayment')}</p>
              )}
            </div>
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-white">
                {t('order.reservations')} <ServiceTag service="inventory" />
              </h2>
              {reservations.length ? (
                <ul className="mt-2 space-y-1 text-sm">
                  {reservations.map((r) => (
                    <li key={r.sku} className="font-mono">
                      {r.sku} × {r.quantity} · {r.status}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-slate-500">{t('order.noReservations')}</p>
              )}
            </div>
          </section>
        </div>
      </div>

      <section className="card mt-6 p-5">
        <h2 className="font-semibold text-white">{t('order.events')}</h2>
        <ul className="divide-y divide-ink-800">
          {notifications.map((n) => (
            <EventRow key={n.id} n={n} showOrder={false} />
          ))}
        </ul>
      </section>
    </>
  )
}
