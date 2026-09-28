import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { OrderStatus } from '../api/types'

const STYLES: Record<OrderStatus, string> = {
  PENDING: 'bg-slate-500/15 text-slate-300 ring-slate-500/30',
  STOCK_RESERVED: 'bg-amber-400/10 text-amber-300 ring-amber-400/30',
  CONFIRMED: 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/30',
  CANCELLED: 'bg-rose-500/10 text-rose-300 ring-rose-500/30',
}

export function StatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  const running = status === 'PENDING' || status === 'STOCK_RESERVED'
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1',
        STYLES[status],
      )}
    >
      {running && <span className="size-1.5 animate-pulse-dot rounded-full bg-current" />}
      {t(`status.${status}`)}
    </span>
  )
}
