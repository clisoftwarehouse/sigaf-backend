import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ConsignmentReturnEntity } from './consignment-return.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_return_items')
export class ConsignmentReturnItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'return_id' })
  returnId: string;

  @Column('uuid', { name: 'consignment_item_id' })
  consignmentItemId: string;

  @Column('uuid', { name: 'lot_id' })
  lotId: string;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { name: 'cost_usd', precision: 18, scale: 4 })
  costUsd: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ConsignmentReturnEntity)
  @JoinColumn({ name: 'return_id' })
  consignmentReturn: ConsignmentReturnEntity;
}
