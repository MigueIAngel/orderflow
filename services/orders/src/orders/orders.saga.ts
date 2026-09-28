import { Injectable, OnModuleInit } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { EventEnvelope } from '../messaging/event.js';
import { OutboxService } from '../messaging/outbox.service.js';
import { StreamConsumer } from '../messaging/stream-consumer.service.js';
import { OrderStatus } from './order.entity.js';
import { OrdersService } from './orders.service.js';

interface SagaData {
  orderId: string;
  reason?: string;
  sku?: string;
}

/** Reacts to inventory and payment events and publishes the final outcome of each order. */
@Injectable()
export class OrdersSaga implements OnModuleInit {
  constructor(
    private readonly consumer: StreamConsumer,
    private readonly orders: OrdersService,
    private readonly outbox: OutboxService,
  ) {}

  onModuleInit() {
    this.consumer.on('stock.reserved', (m, e) => this.onStockReserved(m, e));
    this.consumer.on('stock.rejected', (m, e) => this.onStockRejected(m, e));
    this.consumer.on('payment.succeeded', (m, e) => this.onPaid(m, e));
    this.consumer.on('payment.failed', (m, e) => this.onPaymentFailed(m, e));
  }

  async onStockReserved(manager: EntityManager, event: EventEnvelope) {
    const { orderId } = event.data as unknown as SagaData;
    await this.orders.transition(
      manager,
      orderId,
      OrderStatus.STOCK_RESERVED,
      event.type,
      'Stock reserved',
    );
  }

  async onStockRejected(manager: EntityManager, event: EventEnvelope) {
    const { orderId, reason, sku } = event.data as unknown as SagaData;
    await this.cancel(manager, event, orderId, `${reason}:${sku}`);
  }

  async onPaymentFailed(manager: EntityManager, event: EventEnvelope) {
    const { orderId, reason } = event.data as unknown as SagaData;
    await this.cancel(manager, event, orderId, reason ?? 'payment_failed');
  }

  async onPaid(manager: EntityManager, event: EventEnvelope) {
    const { orderId } = event.data as unknown as SagaData;
    const order = await this.orders.transition(
      manager,
      orderId,
      OrderStatus.CONFIRMED,
      event.type,
      'Payment captured',
    );
    if (order) {
      await this.outbox.add(manager, 'order.confirmed', orderId, {
        orderId,
        customerEmail: order.customerEmail,
        total: order.total,
      });
    }
  }

  private async cancel(
    manager: EntityManager,
    event: EventEnvelope,
    orderId: string,
    reason: string,
  ) {
    const order = await this.orders.transition(
      manager,
      orderId,
      OrderStatus.CANCELLED,
      event.type,
      reason,
    );
    if (order) {
      await this.outbox.add(manager, 'order.cancelled', orderId, {
        orderId,
        customerEmail: order.customerEmail,
        total: order.total,
        reason,
      });
    }
  }
}
