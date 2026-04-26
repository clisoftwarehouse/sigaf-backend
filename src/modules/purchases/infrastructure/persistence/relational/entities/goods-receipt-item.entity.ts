import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { GoodsReceiptEntity } from './goods-receipt.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('goods_receipt_items')
export class GoodsReceiptItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'receipt_id' })
  receiptId: string;

  @Column('uuid', { name: 'purchase_order_id', nullable: true })
  purchaseOrderId: string | null;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'lot_id' })
  lotId: string;

  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { name: 'unit_cost_usd', precision: 18, scale: 4 })
  unitCostUsd: number;

  @Column('decimal', { name: 'discount_pct', precision: 5, scale: 2, default: 0 })
  discountPct: number;

  @Column('decimal', { name: 'subtotal_usd', precision: 18, scale: 4, default: 0 })
  subtotalUsd: number;

  @Column('decimal', { name: 'sale_price', precision: 18, scale: 4 })
  salePrice: number;

  @Column('varchar', { name: 'lot_number', length: 50 })
  lotNumber: string;

  @Column('date', { name: 'expiration_date' })
  expirationDate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => GoodsReceiptEntity)
  @JoinColumn({ name: 'receipt_id' })
  receipt: GoodsReceiptEntity;
}
