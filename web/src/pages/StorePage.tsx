import { useTranslation } from 'react-i18next'
import { useProducts, useRestock } from '../api/hooks'
import { CartPanel } from '../components/CartPanel'
import { ProductCard } from '../components/ProductCard'
import { useCart } from '../store/cart'

export function StorePage() {
  const { t } = useTranslation()
  const { data: products, isPending, isError, refetch } = useProducts()
  const { lines, add } = useCart()
  const restock = useRestock()

  return (
    <>
      <section className="mb-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{t('store.title')}</h1>
        <p className="mt-3 text-slate-400">{t('store.subtitle')}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section className="grid content-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isPending &&
            Array.from({ length: 6 }, (_, i) => <div key={i} className="card h-44 animate-pulse" />)}
          {isError && (
            <div className="card col-span-full p-6 text-sm">
              <p className="text-rose-300">{t('store.error')}</p>
              <button type="button" className="btn btn-ghost mt-3" onClick={() => void refetch()}>
                {t('common.retry')}
              </button>
            </div>
          )}
          {products?.map((p) => (
            <ProductCard
              key={p.sku}
              product={p}
              inCart={lines[p.sku] ?? 0}
              onAdd={() => add(p.sku)}
              onRestock={() => restock.mutate(p.sku)}
              restocking={restock.isPending}
            />
          ))}
        </section>
        <aside>
          <CartPanel products={products ?? []} />
        </aside>
      </div>
    </>
  )
}
