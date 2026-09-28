export type ServiceName = 'inventory' | 'orders' | 'payments' | 'notifications'

export interface Product {
  sku: string
  name_en: string
  name_es: string
  category: string
  emoji: string
  price: number
  stock: number
}

export type OrderStatus = 'PENDING' | 'STOCK_RESERVED' | 'CONFIRMED' | 'CANCELLED'

export interface OrderItem {
  id: number
  sku: string
  name: string
  quantity: number
  unitPrice: number
}

export interface StatusChange {
  id: number
  status: OrderStatus
  event: string | null
  note: string | null
  at: string
}

export interface Order {
  id: string
  customerEmail: string
  total: number
  currency: string
  status: OrderStatus
  cancelReason: string | null
  simulatePaymentFailure: boolean
  items: OrderItem[]
  history?: StatusChange[]
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  order_id: string
  amount: number
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'VOIDED'
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export interface Reservation {
  order_id: string
  sku: string
  quantity: number
  status: 'RESERVED' | 'COMMITTED' | 'RELEASED'
}

export interface Notification {
  id: string
  type: string
  source: string
  orderId: string
  occurredAt: string
  channel: 'feed' | 'email'
  recipient: string | null
  data: Record<string, unknown>
}

export interface OrderSummary {
  order: Order
  payment: Payment | null
  reservations: Reservation[]
  notifications: Notification[]
  unavailable: ServiceName[]
}

export interface ServiceHealth {
  status: 'up' | 'degraded' | 'down'
  latencyMs: number | null
  circuit: 'closed' | 'open' | 'half-open'
}

export interface Health {
  status: 'up' | 'degraded' | 'down'
  services: Record<ServiceName, ServiceHealth>
}

export interface NewOrder {
  customerEmail: string
  items: { sku: string; quantity: number }[]
  simulatePaymentFailure: boolean
}
