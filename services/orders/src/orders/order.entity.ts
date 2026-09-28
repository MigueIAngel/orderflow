import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../database/decimal.transformer.js';

export enum OrderStatus {
  PENDING = 'PENDING',
  STOCK_RESERVED = 'STOCK_RESERVED',
  CONFIRMED = 'CONFIRMED',
  CANCELLED = 'CANCELLED',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 254 })
  customerEmail: string;

  @Column('decimal', {
    precision: 12,
    scale: 2,
    transformer: decimalTransformer,
  })
  total: number;

  @Column({ length: 3, default: 'USD' })
  currency: string;

  @Column({ type: 'varchar', length: 20, default: OrderStatus.PENDING })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 80, nullable: true })
  cancelReason: string | null;

  @Column({ default: false })
  simulatePaymentFailure: boolean;

  @OneToMany(() => OrderItem, (item) => item.order, {
    cascade: true,
    eager: true,
  })
  items: OrderItem[];

  @OneToMany(() => OrderStatusChange, (change) => change.order, {
    cascade: true,
  })
  history: OrderStatusChange[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  order: Order;

  @Column({ length: 40 })
  sku: string;

  @Column({ length: 120 })
  name: string;

  @Column('int')
  quantity: number;

  @Column('decimal', {
    precision: 10,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;
}

/** Timeline of the saga for one order, shown in the UI. */
@Entity('order_status_changes')
export class OrderStatusChange {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Order, (order) => order.history, { onDelete: 'CASCADE' })
  order: Order;

  @Column({ type: 'varchar', length: 20 })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  event: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  note: string | null;

  @CreateDateColumn()
  at: Date;
}
