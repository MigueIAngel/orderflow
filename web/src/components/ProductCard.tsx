import clsx from 'clsx'
import { useTranslation } from 'react-i18next'
import type { Product } from '../api/types'
import { money } from '../lib/format'

interface Props {
  product: Product
  inCart: number
  onAdd: () => void
  onRestock: () => void
  restocking: boolean
}

export function ProductCard({ product, inCart, onAdd, onRestock, restocking }: Props) {
  const { t, i18n } = useTranslation()
  const name = i18n.language === 'es' ? product.name_es : product.name_en
  const out = product.stock === 0

  return (
    <article className="card flex flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-ink-800 text-2xl" aria-hidden>
          {product.emoji}
        </span>
        <span
          className={clsx(
            'rounded-full px-2 py-0.5 text-xs',
            out ? 'bg-rose-500/10 text-rose-300' : product.stock < 5 ? 'bg-amber-400/10 text-amber-300' : 'bg-ink-800 text-slate-400',
          )}
        >
          {out ? t('store.outOfStock') : t('store.inStock', { count: product.stock })}
        </span>
      </div>
      <h3 className="mt-4 font-semibold text-white">{name}</h3>
      <p className="font-mono text-xs text-slate-500">{product.sku}</p>
      <div className="mt-auto pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-semibold">{money(product.price, i18n.language)}</span>
          <button type="button" className="btn btn-primary shrink-0 px-3 py-1.5" onClick={onAdd}>
            {t('store.add')}
            {inCart > 0 && <span className="rounded-md bg-white/20 px-1.5 text-xs">{inCart}</span>}
          </button>
        </div>
        {product.stock < 5 && (
          <button
            type="button"
            className="btn btn-ghost mt-2 w-full py-1.5 text-xs"
            onClick={onRestock}
            disabled={restocking}
          >
            {t('store.restock')}
          </button>
        )}
      </div>
    </article>
  )
}
