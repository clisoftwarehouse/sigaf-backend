import { Column, Entity, OneToMany, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { GoodsReceiptEntity } from './goods-receipt.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { GoodsReceiptItemDiscrepancyEntity } from './goods-receipt-item-discrepancy.entity';

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

  /**
   * Nullable: las recepciones bloqueadas por exceso de tolerancia
   * (`requires_reapproval = true`) NO crean lote hasta ser reaprobadas. El
   * service rellena este FK durante el reapprove.
   */
  @Column('uuid', { name: 'lot_id', nullable: true })
  lotId: string | null;

  /** Cantidad físicamente recibida en sucursal. */
  @Column('decimal', { precision: 12, scale: 3 })
  quantity: number;

  /**
   * Cantidad que dice la factura del proveedor. Puede diferir tanto de la
   * `quantity` ordenada en la OC como de `quantity` (recibido físico).
   * Permite cruzar 3 variables (ordenada / facturada / recibida) y detectar
   * faltantes vs sobrantes vs errores de facturación.
   * Nullable para recepciones legacy creadas antes de Fase C.
   */
  @Column('decimal', { name: 'invoiced_quantity', precision: 18, scale: 4, nullable: true })
  invoicedQuantity: number | null;

  @Column('decimal', { name: 'unit_cost_usd', precision: 18, scale: 4 })
  unitCostUsd: number;

  /**
   * Costo unitario en la moneda nativa de la factura (solo cuando
   * `goods_receipts.native_currency = 'VES'`). El `unit_cost_usd` se computa
   * dividiendo este valor entre `exchange_rate_used` para auditoría:
   * si el operador discute la conversión, este es el número que dice la
   * factura física del proveedor en Bs.
   * NULL cuando la factura está en USD (no aplica conversión).
   */
  @Column('decimal', { name: 'unit_cost_native', nullable: true, precision: 18, scale: 4 })
  unitCostNative: number | null;

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

  @Column('uuid', { name: 'location_id', nullable: true })
  locationId: string | null;

  /**
   * Razón por la que este ítem está en la recepción sin estar en ninguna
   * orden de compra (productos "adicionales"). Valores típicos: 'sample',
   * 'commercial_gift', 'substitute', 'excess', 'other'.
   * NULL cuando el ítem proviene de una OC (`purchase_order_id` no es null).
   */
  @Column('varchar', { name: 'addition_reason', length: 30, nullable: true })
  additionReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => GoodsReceiptEntity)
  @JoinColumn({ name: 'receipt_id' })
  receipt: GoodsReceiptEntity;

  @OneToMany(() => GoodsReceiptItemDiscrepancyEntity, (d) => d.receiptItem, { cascade: true })
  discrepancies: GoodsReceiptItemDiscrepancyEntity[];
}
