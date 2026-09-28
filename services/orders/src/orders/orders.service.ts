import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { TransactionRunner } from '../database/transaction-runner.js';
import { OutboxService } from '../messaging/outbox.service.js';
import { CatalogClient, CatalogUnavailableError } from './catalog.client.js';
import { CreateOrderDto } from './dto/create-order.dto.js';
import { ListOrdersQuery } from './dto/list-orders.query.js';
import {
  Order,
  OrderItem,
  OrderStatus,
  OrderStatusChange,
} from './order.entity.js';

const round = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order) private readonly orders: Repository<Order>,
    private readonly catalog: CatalogClient,
    private readonly outbox: OutboxService,
    private readonly tx: TransactionRunner,
  ) {}

  /**
   * Prices come from the inventory service (synchronous call); stock is checked later,
   * asynchronously, by the saga. The order and its `order.created` event are stored in
   * the same transaction.
   */
  async create(dto: CreateOrderDto): Promise<Order> {
    const quantities = new Map<string, number>();
    for (const line of dto.items) {
      quantities.set(line.sku, (quantities.get(line.sku) ?? 0) + line.quantity);
    }

    let products;
    try {
      products = await this.catalog.findBySkus([...quantities.keys()]);
    } catch (error) {
      if (error instanceof CatalogUnavailableError) {
        throw new ServiceUnavailableException(error.message);
      }
      throw error;
    }
    const bySku = new Map(products.map((p) => [p.sku, p]));
    const unknown = [...quantities.keys()].filter((sku) => !bySku.has(sku));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown SKU(s): ${unknown.join(', ')}`);
    }

    const items = [...quantities].map(([sku, quantity]) => {
      const product = bySku.get(sku)!;
      return Object.assign(new OrderItem(), {
        sku,
        name: product.name_en,
        quantity,
        unitPrice: product.price,
      });
    });
    const total = round(
      items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0),
    );

    const id = await this.tx.run(async (manager) => {
      const order = await manager.save(
        Object.assign(new Order(), {
          customerEmail: dto.customerEmail.toLowerCase(),
          total,
          currency: 'USD',
          status: OrderStatus.PENDING,
          simulatePaymentFailure: dto.simulatePaymentFailure ?? false,
          items,
          history: [
            Object.assign(new OrderStatusChange(), {
              status: OrderStatus.PENDING,
              event: null,
              note: 'Order placed',
            }),
          ],
        }),
      );
      await this.outbox.add(manager, 'order.created', order.id, {
        orderId: order.id,
        customerEmail: order.customerEmail,
        items: items.map(({ sku, quantity, unitPrice }) => ({
          sku,
          quantity,
          unitPrice,
        })),
        total,
        currency: order.currency,
        simulatePaymentFailure: order.simulatePaymentFailure,
      });
      return order.id;
    });
    return this.findOne(id);
  }

  findAll({ status, customerEmail, limit }: ListOrdersQuery) {
    return this.orders.find({
      where: {
        ...(status && { status }),
        ...(customerEmail && { customerEmail: customerEmail.toLowerCase() }),
      },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findOne(id: string): Promise<Order> {
    const order = await this.orders.findOne({
      where: { id },
      relations: { items: true, history: true },
      order: { history: { id: 'ASC' } },
    });
    if (!order) throw new NotFoundException(`Order ${id} not found`);
    return order;
  }

  /**
   * Moves an order along the saga. Terminal states never change, which makes late or
   * duplicated events harmless. Returns the updated order, or null if nothing changed.
   */
  async transition(
    manager: EntityManager,
    orderId: string,
    to: OrderStatus,
    event: string,
    note: string | null = null,
  ): Promise<Order | null> {
    const order = await manager.findOneBy(Order, { id: orderId });
    if (!order) return null;
    const terminal = [OrderStatus.CONFIRMED, OrderStatus.CANCELLED];
    if (terminal.includes(order.status) || order.status === to) return null;

    order.status = to;
    if (to === OrderStatus.CANCELLED) order.cancelReason = note;
    await manager.update(Order, order.id, {
      status: to,
      cancelReason: order.cancelReason,
    });
    await manager.insert(OrderStatusChange, {
      order: { id: order.id },
      status: to,
      event,
      note,
    });
    return order;
  }
}
