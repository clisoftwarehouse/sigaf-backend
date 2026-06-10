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

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { AccountsPayablePaymentEntity } from './accounts-payable-payment.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';

export type AccountsPayableStatus = 'open' | 'partial' | 'paid' | 'cancelled';
export type CurrencyNative = 'USD' | 'VES';

@Index('idx_ap_branch_status_due', ['branchId', 'status', 'dueDate'])
@Index('idx_ap_supplier', ['supplierId', 'status'])
@Entity('accounts_payable')
export class AccountsPayableEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'source_receipt_id', nullable: true })
  sourceReceiptId: string | null;

  @Column('varchar', { name: 'invoice_number', length: 50, nullable: true })
  invoiceNumber: string | null;

  @Column('date', { name: 'invoice_date' })
  invoiceDate: Date;

  @Column('date', { name: 'due_date' })
  dueDate: Date;

  @Column('char', { name: 'currency_native', length: 3, default: 'USD' })
  currencyNative: CurrencyNative;

  @Column('decimal', { name: 'original_amount_usd', precision: 18, scale: 4 })
  originalAmountUsd: number;

  @Column('decimal', { name: 'original_amount_native', precision: 18, scale: 4 })
  originalAmountNative: number;

  @Column('decimal', { name: 'exchange_rate_at_creation', precision: 18, scale: 8, nullable: true })
  exchangeRateAtCreation: number | null;

  @Column('decimal', { name: 'paid_amount_usd', precision: 18, scale: 4, default: 0 })
  paidAmountUsd: number;

  @Column('decimal', { name: 'balance_usd', precision: 18, scale: 4 })
  balanceUsd: number;

  @Column('varchar', { length: 15, default: 'open' })
  status: AccountsPayableStatus;

  @Column('smallint', { name: 'payment_terms_days', default: 30 })
  paymentTermsDays: number;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => SupplierEntity)
  @JoinColumn({ name: 'supplier_id' })
  supplier?: SupplierEntity;

  @ManyToOne(() => BranchEntity)
  @JoinColumn({ name: 'branch_id' })
  branch?: BranchEntity;

  @OneToMany(() => AccountsPayablePaymentEntity, (p) => p.accountsPayable)
  payments?: AccountsPayablePaymentEntity[];
}
