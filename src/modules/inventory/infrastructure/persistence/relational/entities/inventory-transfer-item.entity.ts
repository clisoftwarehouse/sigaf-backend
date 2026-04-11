import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { InventoryTransferEntity } from './inventory-transfer.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('inventory_transfer_items')
export class InventoryTransferItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'transfer_id' })
  transferId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'lot_id' })
  lotId: string;

  @Column('decimal', { name: 'quantity_sent', precision: 12, scale: 3 })
  quantitySent: number;

  @Column('decimal', { name: 'quantity_received', precision: 12, scale: 3, nullable: true })
  quantityReceived: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => InventoryTransferEntity)
  @JoinColumn({ name: 'transfer_id' })
  transfer: InventoryTransferEntity;
}
