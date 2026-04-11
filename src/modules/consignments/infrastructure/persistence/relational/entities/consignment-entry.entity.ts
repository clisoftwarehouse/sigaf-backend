import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_entries')
export class ConsignmentEntryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'entry_number', length: 30, unique: true })
  entryNumber: string;

  @Column('date', { name: 'entry_date', default: () => 'CURRENT_DATE' })
  entryDate: Date;

  @Column('decimal', { name: 'commission_pct', precision: 5, scale: 2 })
  commissionPct: number;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('varchar', { length: 20, default: 'active' })
  status: string;

  @Column('integer', { name: 'total_items', default: 0 })
  totalItems: number;

  @Column('decimal', { name: 'total_cost_usd', precision: 18, scale: 4, default: 0 })
  totalCostUsd: number;

  @Column('uuid', { name: 'received_by' })
  receivedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
