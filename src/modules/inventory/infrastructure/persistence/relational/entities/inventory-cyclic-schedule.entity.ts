import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('inventory_cyclic_schedules')
export class InventoryCyclicScheduleEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { length: 100 })
  name: string;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('char', { name: 'abc_classes', array: true, length: 1 })
  abcClasses: string[];

  @Column('varchar', { name: 'risk_levels', array: true, length: 10, nullable: true })
  riskLevels: string[] | null;

  @Column('smallint', { name: 'frequency_days', default: 7 })
  frequencyDays: number;

  @Column('integer', { name: 'max_skus_per_count', default: 50 })
  maxSkusPerCount: number;

  @Column('boolean', { name: 'auto_generate', default: true })
  autoGenerate: boolean;

  @Column('timestamptz', { name: 'last_generated_at', nullable: true })
  lastGeneratedAt: Date | null;

  @Column('timestamptz', { name: 'next_generation_at', nullable: true })
  nextGenerationAt: Date | null;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
