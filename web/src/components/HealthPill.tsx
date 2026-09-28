import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useHealth } from '../api/hooks'

export function HealthPill() {
  const { t } = useTranslation()
  const { data, isPending, isError } = useHealth()
  const up = data ? Object.values(data.services).filter((s) => s.status === 'up').length : 0
  const status = isError ? 'down' : (data?.status ?? 'checking')
  const label =
    status === 'checking' && isPending
      ? t('health.checking')
      : status === 'up'
        ? t('health.up')
        : status === 'degraded'
          ? t('health.degraded', { count: up })
          : t('health.down')

  return (
    <Link
      to="/architecture"
      title={t('health.title')}
      className="hidden items-center gap-2 rounded-full border border-ink-700 px-3 py-1 text-xs text-slate-300 hover:border-ink-600 sm:inline-flex"
    >
      <span
        className={clsx(
          'size-2 rounded-full',
          status === 'up' && 'bg-emerald-400',
          status === 'degraded' && 'bg-amber-400',
          (status === 'down' || status === 'checking') && 'animate-pulse-dot bg-slate-400',
        )}
      />
      {label}
    </Link>
  )
}
