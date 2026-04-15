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

  @Column('text', { name: 'scope_description', nullable: true })
  scopeDescription: string | null;

  @Column('uuid', { name: 'scope_category_id', nullable: true })
  scopeCategoryId: string | null;

  @Column('uuid', { name: 'scope_location_ids', array: true, nullable: true })
  scopeLocationIds: string[] | null;

  @Column('char', { name: 'scope_abc_classes', array: true, length: 1, nullable: true })
  scopeAbcClasses: string[] | null;

  @Column('varchar', { name: 'scope_risk_levels', array: true, length: 10, nullable: true })
  scopeRiskLevels: string[] | null;

  @Column('boolean', { name: 'blocks_sales', default: false })
  blocksSales: boolean;

  @Column('timestamptz', { name: 'blocked_at', nullable: true })
  blockedAt: Date | null;

  @Column('timestamptz', { name: 'unblocked_at', nullable: true })
  unblockedAt: Date | null;

  @Column('integer', { name: 'total_skus_expected', nullable: true })
  totalSkusExpected: number | null;

  @Column('integer', { name: 'total_skus_counted', nullable: true })
  totalSkusCounted: number | null;

  @Column('integer', { name: 'total_skus_matched', nullable: true })
  totalSkusMatched: number | null;

  @Column('integer', { name: 'total_skus_over', nullable: true })
  totalSkusOver: number | null;

  @Column('integer', { name: 'total_skus_short', nullable: true })
  totalSkusShort: number | null;

  @Column('decimal', { name: 'accuracy_pct', precision: 5, scale: 2, nullable: true })
  accuracyPct: number | null;

  @Column('timestamptz', { name: 'started_at', nullable: true })
  startedAt: Date | null;

  @Column('timestamptz', { name: 'completed_at', nullable: true })
  completedAt: Date | null;

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
