import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ConsignmentEntryEntity } from './consignment-entry.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_entry_items')
export class ConsignmentEntryItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'consignment_entry_id' })
  consignmentEntryId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'lot_id' })
  lotId: string;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { name: 'cost_usd', precision: 18, scale: 4 })
  costUsd: number;

  @Column('decimal', { name: 'quantity_sold', precision: 12, scale: 3, default: 0 })
  quantitySold: number;

  @Column('decimal', { name: 'quantity_returned', precision: 12, scale: 3, default: 0 })
  quantityReturned: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ConsignmentEntryEntity)
  @JoinColumn({ name: 'consignment_entry_id' })
  consignmentEntry: ConsignmentEntryEntity;
}
