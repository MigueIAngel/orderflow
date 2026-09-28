import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Health, NewOrder, Notification, Order, OrderSummary, Product } from './types'

export const keys = {
  products: ['products'] as const,
  orders: ['orders'] as const,
  summary: (id: string) => ['orders', id, 'summary'] as const,
  health: ['health'] as const,
  notifications: ['notifications'] as const,
}

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: () => api<Product[]>('/api/products') })

export const useOrders = () =>
  useQuery({ queryKey: keys.orders, queryFn: () => api<Order[]>('/api/orders?limit=50') })

export const useOrderSummary = (id: string) =>
  useQuery({
    queryKey: keys.summary(id),
    queryFn: () => api<OrderSummary>(`/api/orders/${id}/summary`),
    // Safety net in case the live stream drops while the saga is still running.
    refetchInterval: (query) => {
      const status = query.state.data?.order.status
      return status === 'CONFIRMED' || status === 'CANCELLED' ? false : 4000
    },
  })

export const useHealth = () =>
  useQuery({
    queryKey: keys.health,
    queryFn: () => api<Health>('/api/health'),
    refetchInterval: (query) => (query.state.data?.status === 'up' ? 30_000 : 5000),
    retry: true,
    retryDelay: 3000,
  })

export const useRecentNotifications = () =>
  useQuery({
    queryKey: keys.notifications,
    queryFn: () => api<Notification[]>('/api/notifications?limit=100'),
  })

export function usePlaceOrder() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (order: NewOrder) =>
      api<Order>('/api/orders', { method: 'POST', body: JSON.stringify(order) }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.orders }),
  })
}

export function useRestock() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (sku: string) =>
      api<Product>(`/api/products/${sku}/restock`, {
        method: 'POST',
        body: JSON.stringify({ quantity: 10 }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.products }),
  })
}
