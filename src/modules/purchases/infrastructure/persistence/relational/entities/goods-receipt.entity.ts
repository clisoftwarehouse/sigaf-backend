import { Column, Entity, OneToMany, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { GoodsReceiptItemEntity } from './goods-receipt-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('goods_receipts')
export class GoodsReceiptEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'receipt_number', length: 30, unique: true })
  receiptNumber: string;

  @Column('date', { name: 'receipt_date', default: () => 'CURRENT_DATE' })
  receiptDate: Date;

  @Column('varchar', { name: 'supplier_invoice_number', length: 50, nullable: true })
  supplierInvoiceNumber: string | null;

  @Column('varchar', { name: 'receipt_type', length: 15, default: 'purchase' })
  receiptType: string;

  @Column('varchar', { name: 'import_source', length: 20, nullable: true })
  importSource: string | null;

  @Column('decimal', { name: 'subtotal_usd', precision: 18, scale: 4, default: 0 })
  subtotalUsd: number;

  @Column('decimal', { name: 'total_discount_usd', precision: 18, scale: 4, default: 0 })
  totalDiscountUsd: number;

  @Column('decimal', { name: 'tax_pct', precision: 5, scale: 2, default: 0 })
  taxPct: number;

  @Column('decimal', { name: 'tax_usd', precision: 18, scale: 4, default: 0 })
  taxUsd: number;

  @Column('decimal', { name: 'igtf_pct', precision: 5, scale: 2, default: 0 })
  igtfPct: number;

  @Column('decimal', { name: 'igtf_usd', precision: 18, scale: 4, default: 0 })
  igtfUsd: number;

  @Column('decimal', { name: 'total_usd', precision: 18, scale: 4, default: 0 })
  totalUsd: number;

  /**
   * Moneda en que estaba emitida la factura física del proveedor. Si es 'VES'
   * exigimos `nativeTotal` y `exchangeRateUsed` para auditar contra factura.
   * Si es 'USD' (default) ambos quedan NULL — la factura ya viene en dólares.
   */
  @Column('varchar', { name: 'native_currency', length: 3, default: 'USD' })
  nativeCurrency: 'USD' | 'VES';

  /** Total exacto que dice la factura física, en su moneda original. */
  @Column('decimal', { name: 'native_total', precision: 18, scale: 4, nullable: true })
  nativeTotal: number | null;

  /**
   * Tasa congelada al momento de registrar la recepción. Inmutable: aunque
   * la tasa BCV cambie después, esta queda como evidencia de cómo se calculó
   * el `total_usd` desde el `native_total`.
   */
  @Column('decimal', { name: 'exchange_rate_used', precision: 18, scale: 4, nullable: true })
  exchangeRateUsed: number | null;

  /**
   * FK opcional al registro de la tabla `exchange_rates` que se usó. Permite
   * trazar si fue tasa BCV oficial o un override manual. ON DELETE SET NULL
   * para no romper recepciones históricas si se purga la tabla de tasas.
   */
  @Column('uuid', { name: 'exchange_rate_id', nullable: true })
  exchangeRateId: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'received_by' })
  receivedBy: string;

  /**
   * True cuando la recepción excedió alguna tolerancia (cantidad o costo) y
   * está bloqueada hasta que un usuario con autoridad la reapruebe.
   * Mientras `requires_reapproval = true` los lotes NO se crean ni el precio
   * se publica al módulo de pricing.
   */
  @Column('boolean', { name: 'requires_reapproval', default: false })
  requiresReapproval: boolean;

  @Column('uuid', { name: 'reapproved_by', nullable: true })
  reapprovedBy: string | null;

  @Column('timestamptz', { name: 'reapproved_at', nullable: true })
  reapprovedAt: Date | null;

  @Column('text', { name: 'reapproval_justification', nullable: true })
  reapprovalJustification: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => GoodsReceiptItemEntity, (item) => item.receipt, { cascade: true })
  items: GoodsReceiptItemEntity[];
}
