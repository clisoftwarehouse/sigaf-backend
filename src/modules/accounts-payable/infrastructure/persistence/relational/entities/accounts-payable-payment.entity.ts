import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { type CurrencyNative, AccountsPayableEntity } from './accounts-payable.entity';

export type PaymentMethod = 'cash' | 'transfer' | 'check' | 'dollars' | 'mixed' | 'other';

@Index('idx_ap_payments_cxp', ['accountsPayableId', 'reversedAt'])
@Index('idx_ap_payments_date', ['paymentDate'])
@Entity('accounts_payable_payments')
export class AccountsPayablePaymentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'accounts_payable_id' })
  accountsPayableId: string;

  @Column('date', { name: 'payment_date', default: () => 'CURRENT_DATE' })
  paymentDate: Date;

  @Column('decimal', { name: 'amount_usd', precision: 18, scale: 4 })
  amountUsd: number;

  @Column('decimal', { name: 'amount_native', precision: 18, scale: 4 })
  amountNative: number;

  @Column('char', { name: 'currency_native', length: 3, default: 'USD' })
  currencyNative: CurrencyNative;

  @Column('decimal', { name: 'exchange_rate', precision: 18, scale: 8, nullable: true })
  exchangeRate: number | null;

  @Column('varchar', { length: 20 })
  method: PaymentMethod;

  @Column('varchar', { length: 100, nullable: true })
  reference: string | null;

  @Column('uuid', { name: 'bank_account_id', nullable: true })
  bankAccountId: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'paid_by_user_id' })
  paidByUserId: string;

  @Column('timestamptz', { name: 'reversed_at', nullable: true })
  reversedAt: Date | null;

  @Column('uuid', { name: 'reversed_by_user_id', nullable: true })
  reversedByUserId: string | null;

  @Column('text', { name: 'reversed_reason', nullable: true })
  reversedReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => AccountsPayableEntity, (cxp) => cxp.payments)
  @JoinColumn({ name: 'accounts_payable_id' })
  accountsPayable?: AccountsPayableEntity;
}
