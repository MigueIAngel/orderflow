import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useRecentNotifications } from '../api/hooks'
import { EventRow } from '../components/EventRow'
import { useFeed } from '../store/feed'

export function EventsPage() {
  const { t } = useTranslation()
  const { live, connected } = useFeed()
  const { data: earlier } = useRecentNotifications()
  const history = (earlier ?? []).filter((n) => !live.some((l) => l.id === n.id))

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('events.title')}</h1>
        <span className="inline-flex items-center gap-2 text-sm text-slate-400">
          <span className={clsx('size-2 rounded-full', connected ? 'bg-emerald-400' : 'animate-pulse-dot bg-amber-400')} />
          {connected ? t('events.connected') : t('events.disconnected')}
        </span>
      </div>
      <p className="mt-2 max-w-3xl text-slate-400">{t('events.subtitle')}</p>

      <section className="card mt-6 px-5">
        {live.length === 0 ? (
          <p className="py-6 text-sm text-slate-400">{t('events.empty')}</p>
        ) : (
          <ul className="divide-y divide-ink-800">
            {live.map((n) => (
              <EventRow key={n.id} n={n} />
            ))}
          </ul>
        )}
      </section>

      {history.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-slate-400 uppercase">{t('events.earlier')}</h2>
          <ul className="card divide-y divide-ink-800 px-5 opacity-80">
            {history.map((n) => (
              <EventRow key={n.id} n={n} />
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
