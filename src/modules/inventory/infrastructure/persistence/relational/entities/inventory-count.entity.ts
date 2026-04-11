import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('inventory_counts')
export class InventoryCountEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { name: 'count_number', length: 30, unique: true })
  countNumber: string;

  @Column('varchar', { name: 'count_type', length: 20, default: 'full' })
  countType: string;

  @Column('varchar', { length: 20, default: 'draft' })
  status: string;

  @Column('date', { name: 'count_date', default: () => 'CURRENT_DATE' })
  countDate: Date;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @Column('uuid', { name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column('timestamptz', { name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
