import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('exchange_rates')
@Index('idx_exchange_rates_date', ['effectiveDate'])
export class ExchangeRateEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'currency_from', length: 3, default: 'USD' })
  currencyFrom: string;

  @Column('varchar', { name: 'currency_to', length: 3, default: 'VES' })
  currencyTo: string;

  @Column('decimal', { precision: 18, scale: 4 })
  rate: number;

  @Column('varchar', { length: 50, default: 'BCV' })
  source: string;

  @Column('date', { name: 'effective_date' })
  effectiveDate: Date;

  @Column('boolean', { name: 'is_overridden', default: false })
  isOverridden: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
