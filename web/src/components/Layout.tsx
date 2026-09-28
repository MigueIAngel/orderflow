import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet } from 'react-router'
import { API_URL } from '../api/client'
import { useEventStream } from '../lib/useEventStream'
import { HealthPill } from './HealthPill'
import { WakeUpNotice } from './WakeUpNotice'

const REPO = 'https://github.com/MigueIAngel/orderflow'

export function Layout() {
  const { t, i18n } = useTranslation()
  useEventStream()
  const links = [
    { to: '/', label: t('nav.store') },
    { to: '/orders', label: t('nav.orders') },
    { to: '/events', label: t('nav.events') },
    { to: '/architecture', label: t('nav.architecture') },
  ]

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b border-ink-800 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <NavLink to="/" className="flex items-center gap-2 font-bold tracking-tight">
            <img src="/favicon.svg" alt="" className="size-7" />
            OrderFlow
          </NavLink>
          <nav className="flex flex-1 gap-1 overflow-x-auto">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === '/'}
                className={({ isActive }) =>
                  clsx(
                    'whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition',
                    isActive ? 'bg-ink-800 text-white' : 'text-slate-400 hover:text-white',
                  )
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
          <HealthPill />
          <button
            type="button"
            onClick={() => void i18n.changeLanguage(i18n.language === 'es' ? 'en' : 'es')}
            className="btn btn-ghost px-2.5 py-1 text-xs"
            aria-label={t('lang.switch')}
          >
            {t('lang.code')}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
        <WakeUpNotice />
        <Outlet />
      </main>

      <footer className="border-t border-ink-800 py-6 text-sm text-slate-500">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4">
          <span>{t('footer.by')}</span>
          <div className="flex gap-4">
            <a href={`${API_URL}/docs`} className="hover:text-slate-200" target="_blank" rel="noreferrer">
              {t('nav.docs')}
            </a>
            <a href={REPO} className="hover:text-slate-200" target="_blank" rel="noreferrer">
              {t('footer.source')}
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
