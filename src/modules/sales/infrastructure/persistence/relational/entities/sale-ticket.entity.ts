import {
  Index,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SaleTicketItemEntity } from './sale-ticket-item.entity';
import { SaleTicketPaymentEntity } from './sale-ticket-payment.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';
import { CustomerEntity } from '@/modules/customers/infrastructure/persistence/relational/entities/customer.entity';
import { CashSessionEntity } from '@/modules/cash-sessions/infrastructure/persistence/relational/entities/cash-session.entity';

export type SaleTicketStatus = 'finalized' | 'voided';
export type SaleTicketType = 'sale' | 'return';

@Entity('sale_tickets')
@Index('idx_sale_tickets_branch_created', ['branchId', 'createdAt'])
@Index('idx_sale_tickets_cash_session', ['cashSessionId'])
@Index('idx_sale_tickets_status', ['status'])
export class SaleTicketEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'client_uuid', unique: true })
  clientUuid: string;

  @Column('varchar', { name: 'idempotency_key', length: 100, nullable: true, unique: true })
  idempotencyKey: string | null;

  @Column('int', { name: 'ticket_number' })
  ticketNumber: number;

  /**
   * Número provisional asignado por el POS al cerrar la venta sin conexión
   * (`T1-001`, `T2-005`, etc.). Único globalmente por el prefijo del
   * terminal. Permite búsqueda cross-terminal cuando el cliente vuelve a
   * devolver con un ticket impreso offline.
   */
  @Column('varchar', { name: 'provisional_number', length: 30, nullable: true, unique: true })
  provisionalNumber: string | null;

  @Column('varchar', { name: 'control_number', length: 50, nullable: true })
  controlNumber: string | null;

  @Column('uuid', { name: 'cash_session_id' })
  cashSessionId: string;

  @ManyToOne(() => CashSessionEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSessionEntity;

  @Column('uuid', { name: 'terminal_id' })
  terminalId: string;

  @ManyToOne(() => TerminalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'terminal_id' })
  terminal: TerminalEntity;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => BranchEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity;

  @Column('uuid', { name: 'customer_id', nullable: true })
  customerId: string | null;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity | null;

  @Column('uuid', { name: 'salesperson_user_id' })
  salespersonUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'salesperson_user_id' })
  salesperson: UserEntity;

  @Column('varchar', { length: 20, default: 'finalized' })
  status: SaleTicketStatus;

  @Column('varchar', { length: 10, default: 'sale' })
  type: SaleTicketType;

  @Column('uuid', { name: 'reference_ticket_id', nullable: true })
  referenceTicketId: string | null;

  @ManyToOne(() => SaleTicketEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'reference_ticket_id' })
  referenceTicket: SaleTicketEntity | null;

  @Column('numeric', { name: 'subtotal_exempt_usd', precision: 18, scale: 4, default: 0 })
  subtotalExemptUsd: number;

  @Column('numeric', { name: 'subtotal_taxable_usd', precision: 18, scale: 4, default: 0 })
  subtotalTaxableUsd: number;

  @Column('numeric', { name: 'vat_amount_usd', precision: 18, scale: 4, default: 0 })
  vatAmountUsd: number;

  @Column('numeric', { name: 'igtf_amount_usd', precision: 18, scale: 4, default: 0 })
  igtfAmountUsd: number;

  @Column('numeric', { name: 'total_usd', precision: 18, scale: 4, default: 0 })
  totalUsd: number;

  @Column('numeric', { name: 'total_paid_usd', precision: 18, scale: 4, default: 0 })
  totalPaidUsd: number;

  @Column('numeric', { name: 'change_usd', precision: 18, scale: 4, default: 0 })
  changeUsd: number;

  @Column('numeric', { name: 'exchange_rate_usd_bs', precision: 18, scale: 6 })
  exchangeRateUsdBs: number;

  @Column('numeric', { name: 'total_bs', precision: 18, scale: 2, default: 0 })
  totalBs: number;

  @Column('text', { name: 'void_reason', nullable: true })
  voidReason: string | null;

  @Column('timestamptz', { name: 'voided_at', nullable: true })
  voidedAt: Date | null;

  @Column('uuid', { name: 'voided_by_user_id', nullable: true })
  voidedByUserId: string | null;

  @Column('timestamptz', { name: 'client_created_at', nullable: true })
  clientCreatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => SaleTicketItemEntity, (i) => i.saleTicket, {
    cascade: ['insert'],
  })
  items: SaleTicketItemEntity[];

  @OneToMany(() => SaleTicketPaymentEntity, (p) => p.saleTicket, {
    cascade: ['insert'],
  })
  payments: SaleTicketPaymentEntity[];
}
