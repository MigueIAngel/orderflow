import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { useHealth } from '../api/hooks'
import type { ServiceName } from '../api/types'
import { serviceDot } from '../components/ServiceTag'

const SERVICES: ServiceName[] = ['orders', 'inventory', 'payments', 'notifications']
const PATTERNS = ['saga', 'outbox', 'idempotency', 'compensation', 'gateway', 'sse'] as const

function Box({ name, children }: { name: string; children?: React.ReactNode }) {
  const { t } = useTranslation()
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2">
        <span className={clsx('size-2.5 rounded-full', serviceDot[name] ?? 'bg-red-400')} />
        <span className="font-mono text-sm font-semibold text-white">{name}</span>
      </div>
      <p className="mt-1 text-xs text-slate-400">{t(`arch.services.${name}`)}</p>
      {children}
    </div>
  )
}

export function ArchitecturePage() {
  const { t } = useTranslation()
  const { data } = useHealth()

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight text-white">{t('arch.title')}</h1>
      <p className="mt-2 text-slate-400">{t('arch.subtitle')}</p>

      <section className="mt-8 grid gap-4" aria-label="diagram">
        <div className="mx-auto w-full max-w-md text-center">
          <div className="card px-4 py-3 text-sm text-slate-300">Browser · React</div>
          <div className="mx-auto h-6 w-0.5 bg-ink-600" />
          <Box name="gateway" />
          <div className="mx-auto h-6 w-0.5 bg-ink-600" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SERVICES.map((name) => {
            const health = data?.services[name]
            return (
              <Box key={name} name={name}>
                <p className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={clsx(
                      'rounded-full px-2 py-0.5',
                      health?.status === 'up' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-ink-800 text-slate-400',
                    )}
                  >
                    {health?.status ?? '…'}
                  </span>
                  {health?.latencyMs != null && (
                    <span className="font-mono text-slate-500">{t('arch.latency', { ms: health.latencyMs })}</span>
                  )}
                  {health && <span className="font-mono text-slate-500">{t('arch.circuit', { state: health.circuit })}</span>}
                </p>
              </Box>
            )
          })}
        </div>
        <div className="mx-auto h-6 w-0.5 bg-ink-600" />
        <div className="mx-auto w-full max-w-md">
          <Box name="redis" />
        </div>
      </section>

      <h2 className="mt-12 text-xl font-semibold text-white">{t('arch.patterns')}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PATTERNS.map((key) => {
          const [title, body] = t(`arch.p.${key}`, { returnObjects: true }) as [string, string]
          return (
            <article key={key} className="card p-5">
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-400">{body}</p>
            </article>
          )
        })}
      </div>
    </>
  )
}
