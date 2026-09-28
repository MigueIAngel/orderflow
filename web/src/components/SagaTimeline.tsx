import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { reasonText } from '../lib/describe'
import { time } from '../lib/format'
import type { SagaStep } from '../lib/saga'
import { ServiceTag } from './ServiceTag'

const ICON: Record<SagaStep['state'], string> = {
  done: '✓',
  failed: '✕',
  current: '',
  pending: '',
  skipped: '–',
}

export function SagaTimeline({ steps }: { steps: SagaStep[] }) {
  const { t, i18n } = useTranslation()
  return (
    <ol className="relative">
      {steps.map((step, index) => (
        <li key={step.key} className="relative flex gap-4 pb-6 last:pb-0" data-state={step.state}>
          {index < steps.length - 1 && (
            <span
              className={clsx(
                'absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5',
                step.state === 'done' ? 'bg-emerald-400/50' : 'bg-ink-700',
              )}
            />
          )}
          <span
            className={clsx(
              'relative grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ring-2',
              step.state === 'done' && 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/60',
              step.state === 'failed' && 'bg-rose-500/15 text-rose-300 ring-rose-500/60',
              step.state === 'current' && 'bg-indigo-500/15 ring-indigo-400',
              step.state === 'pending' && 'bg-ink-850 ring-ink-600',
              step.state === 'skipped' && 'bg-ink-850 text-slate-500 ring-ink-700',
            )}
          >
            {step.state === 'current' ? (
              <span className="size-2.5 animate-pulse-dot rounded-full bg-indigo-400" />
            ) : (
              ICON[step.state]
            )}
          </span>
          <div className="min-w-0 pt-1">
            <p
              className={clsx(
                'font-medium',
                step.state === 'skipped' || step.state === 'pending' ? 'text-slate-500' : 'text-slate-100',
              )}
            >
              {t(`order.steps.${step.label}`)}
              {step.state === 'current' && <span className="ml-2 text-sm text-indigo-300">{t('order.steps.waiting')}</span>}
              {step.state === 'skipped' && <span className="ml-2 text-sm">({t('order.steps.skipped')})</span>}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <ServiceTag service={step.service} />
              {step.at && <time className="font-mono">{time(step.at, i18n.language)}</time>}
              {step.detail && <span className="text-rose-300">{reasonText(step.detail, t)}</span>}
            </div>
            {step.compensated && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-lg bg-amber-400/10 px-2 py-1 text-xs text-amber-200">
                ↺ {t('event.stock_released')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
