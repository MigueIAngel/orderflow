import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Events waiting to be published, written in the same transaction as the state change. */
@Entity('outbox_messages')
export class OutboxMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true, length: 36 })
  eventId: string;

  @Column({ length: 50 })
  eventType: string;

  @Column('text')
  payload: string;

  @CreateDateColumn()
  createdAt: Date;

  @Index()
  @Column({ type: Date, nullable: true })
  publishedAt: Date | null;
}

/** Events already handled; makes the consumer idempotent under redelivery. */
@Entity('processed_events')
export class ProcessedEvent {
  @PrimaryColumn({ length: 36 })
  eventId: string;

  @Column({ length: 50 })
  eventType: string;

  @CreateDateColumn()
  processedAt: Date;
}
