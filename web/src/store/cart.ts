import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const MAX_PER_LINE = 50

interface CartState {
  lines: Record<string, number>
  email: string
  add: (sku: string) => void
  setQuantity: (sku: string, quantity: number) => void
  clear: () => void
  setEmail: (email: string) => void
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      lines: {},
      email: '',
      add: (sku) =>
        set((s) => ({
          lines: { ...s.lines, [sku]: Math.min(MAX_PER_LINE, (s.lines[sku] ?? 0) + 1) },
        })),
      setQuantity: (sku, quantity) =>
        set((s) => {
          const lines = { ...s.lines }
          if (quantity <= 0) delete lines[sku]
          else lines[sku] = Math.min(MAX_PER_LINE, quantity)
          return { lines }
        }),
      clear: () => set({ lines: {} }),
      setEmail: (email) => set({ email }),
    }),
    { name: 'orderflow.cart' },
  ),
)

export function cartTotal(lines: Record<string, number>, prices: Record<string, number>) {
  const total = Object.entries(lines).reduce((sum, [sku, q]) => sum + (prices[sku] ?? 0) * q, 0)
  return Math.round(total * 100) / 100
}
