import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useOrders } from '../api/hooks'
import { StatusBadge } from '../components/StatusBadge'
import { dateTime, money, shortId } from '../lib/format'

export function OrdersPage() {
  const { t, i18n } = useTranslation()
  const { data: orders, isPending } = useOrders()

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-white">{t('orders.title')}</h1>
      <p className="mt-2 text-slate-400">{t('orders.subtitle')}</p>

      <div className="card mt-6 overflow-hidden">
        {isPending && <p className="p-6 text-sm text-slate-400">{t('common.loading')}</p>}
        {orders?.length === 0 && <p className="p-6 text-sm text-slate-400">{t('orders.empty')}</p>}
        <ul className="divide-y divide-ink-800">
          {orders?.map((o) => (
            <li key={o.id}>
              <Link
                to={`/orders/${o.id}`}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 transition hover:bg-ink-850"
              >
                <span className="font-mono text-sm text-indigo-300">#{shortId(o.id)}</span>
                <span className="min-w-40 flex-1 truncate text-sm text-slate-300">
                  {t('orders.items', { count: o.items.reduce((n, i) => n + i.quantity, 0) })} ·{' '}
                  {o.items.map((i) => i.sku).join(', ')}
                </span>
                <span className="text-xs text-slate-500">{dateTime(o.createdAt, i18n.language)}</span>
                <span className="w-24 text-right font-semibold">{money(o.total, i18n.language)}</span>
                <StatusBadge status={o.status} />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </>
  )
}
