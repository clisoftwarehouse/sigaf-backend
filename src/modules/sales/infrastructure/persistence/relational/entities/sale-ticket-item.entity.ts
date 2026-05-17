import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { SaleTicketEntity } from './sale-ticket.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { PrescriptionItemEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription-item.entity';

@Entity('sale_ticket_items')
@Index('idx_sale_ticket_items_ticket', ['saleTicketId'])
@Index('idx_sale_ticket_items_product', ['productId'])
export class SaleTicketItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'sale_ticket_id' })
  saleTicketId: string;

  @ManyToOne(() => SaleTicketEntity, (t) => t.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_ticket_id' })
  saleTicket: SaleTicketEntity;

  @Column('int', { name: 'line_number' })
  lineNumber: number;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column('uuid', { name: 'lot_id', nullable: true })
  lotId: string | null;

  @ManyToOne(() => InventoryLotEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'lot_id' })
  lot: InventoryLotEntity | null;

  @Column('varchar', { name: 'product_sku', length: 100 })
  productSku: string;

  @Column('varchar', { name: 'product_name', length: 255 })
  productName: string;

  @Column('numeric', { name: 'unit_price_usd', precision: 18, scale: 4 })
  unitPriceUsd: number;

  @Column('numeric', { name: 'vat_rate', precision: 5, scale: 4, default: 0 })
  vatRate: number;

  @Column('numeric', { name: 'discount_percent', precision: 5, scale: 2, default: 0 })
  discountPercent: number;

  @Column('numeric', { precision: 12, scale: 3 })
  quantity: number;

  @Column('numeric', { name: 'line_subtotal_exempt_usd', precision: 18, scale: 4, default: 0 })
  lineSubtotalExemptUsd: number;

  @Column('numeric', { name: 'line_subtotal_taxable_usd', precision: 18, scale: 4, default: 0 })
  lineSubtotalTaxableUsd: number;

  @Column('numeric', { name: 'line_vat_usd', precision: 18, scale: 4, default: 0 })
  lineVatUsd: number;

  @Column('numeric', { name: 'line_total_usd', precision: 18, scale: 4, default: 0 })
  lineTotalUsd: number;

  @Column('boolean', { name: 'requires_rx', default: false })
  requiresRx: boolean;

  @Column('uuid', { name: 'prescription_item_id', nullable: true })
  prescriptionItemId: string | null;

  @ManyToOne(() => PrescriptionItemEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'prescription_item_id' })
  prescriptionItem: PrescriptionItemEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
