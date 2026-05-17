import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { SaleTicketEntity } from './sale-ticket.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

export type SalePaymentMethod = 'EFECTIVO_USD' | 'EFECTIVO_BS' | 'PAGO_MOVIL' | 'TDD' | 'TDC' | 'ZELLE' | 'OTRO';

@Entity('sale_ticket_payments')
@Index('idx_sale_ticket_payments_ticket', ['saleTicketId'])
export class SaleTicketPaymentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'sale_ticket_id' })
  saleTicketId: string;

  @ManyToOne(() => SaleTicketEntity, (t) => t.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_ticket_id' })
  saleTicket: SaleTicketEntity;

  @Column('varchar', { name: 'payment_method', length: 30 })
  paymentMethod: SalePaymentMethod;

  @Column('numeric', { name: 'amount_usd', precision: 18, scale: 4 })
  amountUsd: number;

  @Column('numeric', { name: 'amount_bs', precision: 18, scale: 2, default: 0 })
  amountBs: number;

  @Column('numeric', {
    name: 'exchange_rate_used',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  exchangeRateUsed: number | null;

  @Column('boolean', { name: 'is_fx', default: false })
  isFx: boolean;

  @Column('varchar', { name: 'reference_number', length: 100, nullable: true })
  referenceNumber: string | null;

  @Column('varchar', { name: 'card_last4', length: 4, nullable: true })
  cardLast4: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
