import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_liquidations')
export class ConsignmentLiquidationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'liquidation_number', length: 30, unique: true })
  liquidationNumber: string;

  @Column('date', { name: 'period_start' })
  periodStart: Date;

  @Column('date', { name: 'period_end' })
  periodEnd: Date;

  @Column('decimal', { name: 'total_sold_usd', precision: 18, scale: 4, default: 0 })
  totalSoldUsd: number;

  @Column('decimal', { name: 'commission_usd', precision: 18, scale: 4, default: 0 })
  commissionUsd: number;

  @Column('decimal', { name: 'amount_due_usd', precision: 18, scale: 4, default: 0 })
  amountDueUsd: number;

  @Column('varchar', { length: 20, default: 'draft' })
  status: string;

  @Column('uuid', { name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column('timestamptz', { name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
