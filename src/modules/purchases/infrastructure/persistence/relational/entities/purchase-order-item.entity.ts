import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PurchaseOrderEntity } from './purchase-order.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('purchase_order_items')
export class PurchaseOrderItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'order_id' })
  orderId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { name: 'unit_cost_usd', precision: 18, scale: 4 })
  unitCostUsd: number;

  @Column('decimal', { name: 'discount_pct', precision: 5, scale: 2, default: 0 })
  discountPct: number;

  @Column('decimal', { name: 'subtotal_usd', precision: 18, scale: 4 })
  subtotalUsd: number;

  @Column('decimal', { name: 'quantity_received', precision: 12, scale: 3, default: 0 })
  quantityReceived: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PurchaseOrderEntity)
  @JoinColumn({ name: 'order_id' })
  order: PurchaseOrderEntity;
}
