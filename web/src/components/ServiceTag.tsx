import clsx from 'clsx'

const COLORS: Record<string, string> = {
  gateway: 'text-svc-gateway border-svc-gateway/40',
  orders: 'text-svc-orders border-svc-orders/40',
  inventory: 'text-svc-inventory border-svc-inventory/40',
  payments: 'text-svc-payments border-svc-payments/40',
  notifications: 'text-svc-notifications border-svc-notifications/40',
}

export function ServiceTag({ service, className }: { service: string; className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-md border px-1.5 py-0.5 font-mono text-[11px] leading-none',
        COLORS[service] ?? 'border-ink-600 text-slate-400',
        className,
      )}
    >
      {service}
    </span>
  )
}

export const serviceDot: Record<string, string> = {
  gateway: 'bg-svc-gateway',
  orders: 'bg-svc-orders',
  inventory: 'bg-svc-inventory',
  payments: 'bg-svc-payments',
  notifications: 'bg-svc-notifications',
}
