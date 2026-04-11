import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

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

  @Column('decimal', { name: 'system_quantity', precision: 12, scale: 3 })
  systemQuantity: number;

  @Column('decimal', { name: 'counted_quantity', precision: 12, scale: 3, nullable: true })
  countedQuantity: number | null;

  @Column('decimal', { precision: 12, scale: 3, nullable: true })
  difference: number | null;

  @Column('uuid', { name: 'counted_by', nullable: true })
  countedBy: string | null;

  @Column('timestamptz', { name: 'counted_at', nullable: true })
  countedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => InventoryCountEntity)
  @JoinColumn({ name: 'count_id' })
  count: InventoryCountEntity;
}
