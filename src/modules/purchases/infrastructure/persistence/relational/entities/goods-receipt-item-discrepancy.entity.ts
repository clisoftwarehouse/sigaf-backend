import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { GoodsReceiptItemEntity } from './goods-receipt-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Catálogo cerrado de razones de discrepancia entre lo facturado y lo recibido.
 * Definido en PDF Política OC §5 Q4. Si el cliente necesita una razón nueva,
 * agregarla aquí y al CHECK constraint de la tabla.
 */
export type DiscrepancyReason =
  | 'expired'
  | 'defective'
  | 'damaged_packaging'
  | 'damaged_in_transit'
  | 'incorrect_product'
  | 'missing'
  | 'excess'
  | 'quality_failure'
  | 'other';

export const DISCREPANCY_REASONS: DiscrepancyReason[] = [
  'expired',
  'defective',
  'damaged_packaging',
  'damaged_in_transit',
  'incorrect_product',
  'missing',
  'excess',
  'quality_failure',
  'other',
];

/**
 * Una discrepancia explica por qué la cantidad recibida físicamente difiere
 * de la facturada (o de lo ordenado en la OC). El operador puede registrar
 * múltiples discrepancias por línea con diferentes razones, pero la suma de
 * cantidades debe cuadrar con la diferencia total reportada (validado en
 * `purchases.service`).
 */
@Entity('goods_receipt_item_discrepancies')
export class GoodsReceiptItemDiscrepancyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'receipt_item_id' })
  receiptItemId: string;

  @ManyToOne(() => GoodsReceiptItemEntity, (i) => i.discrepancies, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'receipt_item_id' })
  receiptItem: GoodsReceiptItemEntity;

  @Column('varchar', { length: 30 })
  reason: DiscrepancyReason;

  @Column('decimal', { precision: 18, scale: 4 })
  quantity: number;

  @Column('text', { nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
