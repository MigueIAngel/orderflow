import { useTranslation } from 'react-i18next'
import { useHealth } from '../api/hooks'

/** Shown while the free-tier backend is still booting. */
export function WakeUpNotice() {
  const { t } = useTranslation()
  const { data, isError } = useHealth()
  const asleep = isError || (data !== undefined && data.status !== 'up')
  if (!asleep) return null
  return (
    <div role="status" className="card mb-6 flex gap-4 border-indigo-500/40 bg-indigo-500/10 p-4">
      <span className="mt-1 size-3 shrink-0 animate-pulse-dot rounded-full bg-indigo-400" />
      <div>
        <p className="font-semibold text-indigo-200">{t('wake.title')}</p>
        <p className="mt-1 text-sm text-indigo-100/80">{t('wake.body')}</p>
      </div>
    </div>
  )
}
