import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import type { Notification } from '../api/types'
import { describeEvent } from '../lib/describe'
import { shortId, time } from '../lib/format'
import { ServiceTag, serviceDot } from './ServiceTag'

export function EventRow({ n, showOrder = true }: { n: Notification; showOrder?: boolean }) {
  const { t, i18n } = useTranslation()
  return (
    <li className="flex animate-slide-in items-start gap-3 py-3">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${serviceDot[n.source] ?? 'bg-slate-500'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-100">{describeEvent(n, t, i18n.language)}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span className="font-mono text-slate-300">{n.type}</span>
          <ServiceTag service={n.source} />
          {showOrder && (
            <Link to={`/orders/${n.orderId}`} className="font-mono hover:text-indigo-300">
              #{shortId(n.orderId)}
            </Link>
          )}
          {n.channel === 'email' && n.recipient && (
            <span className="text-svc-notifications">✉ {t('events.email', { to: n.recipient })}</span>
          )}
        </div>
      </div>
      <time className="shrink-0 font-mono text-xs text-slate-500">{time(n.occurredAt, i18n.language)}</time>
    </li>
  )
}
