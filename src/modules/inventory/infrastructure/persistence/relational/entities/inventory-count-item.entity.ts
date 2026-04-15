import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { InventoryCountEntity } from './inventory-count.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('inventory_count_items')
export class InventoryCountItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'count_id' })
  countId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'lot_id', nullable: true })
  lotId: string | null;

  @Column('uuid', { name: 'location_id', nullable: true })
  locationId: string | null;

  @Column('decimal', { name: 'expected_quantity', precision: 12, scale: 3 })
  expectedQuantity: number;

  @Column('varchar', { name: 'expected_lot_number', length: 50, nullable: true })
  expectedLotNumber: string | null;

  @Column('date', { name: 'expected_expiration_date', nullable: true })
  expectedExpirationDate: Date | null;

  @Column('decimal', { name: 'system_quantity', precision: 12, scale: 3 })
  systemQuantity: number;

  @Column('decimal', { name: 'counted_quantity', precision: 12, scale: 3, nullable: true })
  countedQuantity: number | null;

  @Column('varchar', { name: 'counted_lot_number', length: 50, nullable: true })
  countedLotNumber: string | null;

  @Column('date', { name: 'counted_expiration_date', nullable: true })
  countedExpirationDate: Date | null;

  @Column('varchar', { name: 'counted_expiry_signal', length: 10, nullable: true })
  countedExpirySignal: string | null;

  @Column('decimal', { precision: 12, scale: 3, nullable: true })
  difference: number | null;

  @Column('varchar', { name: 'difference_type', length: 10, nullable: true })
  differenceType: string | null;

  @Column('uuid', { name: 'adjustment_id', nullable: true })
  adjustmentId: string | null;

  @Column('uuid', { name: 'counted_by', nullable: true })
  countedBy: string | null;

  @Column('timestamptz', { name: 'counted_at', nullable: true })
  countedAt: Date | null;

  @Column('varchar', { name: 'device_type', length: 20, nullable: true })
  deviceType: string | null;

  @Column('boolean', { name: 'is_recounted', default: false })
  isRecounted: boolean;

  @Column('text', { name: 'recount_reason', nullable: true })
  recountReason: string | null;

  @Column('boolean', { name: 'is_synced', default: true })
  isSynced: boolean;

  @Column('timestamptz', { name: 'local_counted_at', nullable: true })
  localCountedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => InventoryCountEntity)
  @JoinColumn({ name: 'count_id' })
  count: InventoryCountEntity;
}
