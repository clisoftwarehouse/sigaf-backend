import { Column, Entity, Unique, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { SupplierEntity } from './supplier.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

@Entity('supplier_products')
@Unique(['supplierId', 'productId'])
export class SupplierProductEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('varchar', { name: 'supplier_sku', length: 50, nullable: true })
  supplierSku: string | null;

  @Column('decimal', { name: 'cost_usd', precision: 18, scale: 4, nullable: true })
  costUsd: number | null;

  @Column('decimal', { name: 'last_cost_usd', precision: 18, scale: 4, nullable: true })
  lastCostUsd: number | null;

  @Column('decimal', { name: 'discount_pct', precision: 5, scale: 2, default: 0 })
  discountPct: number;

  @Column('boolean', { name: 'is_available', default: true })
  isAvailable: boolean;

  // ─── Comparador de droguerías (Compras Intelligence) ──────────────────
  // Estos campos nutren el `comparator.service` interno que rankea
  // droguerías por costo+disponibilidad+vencimiento+crédito+entrega.
  // Todos nullable para no romper supplier_products legacy.

  @Column('decimal', { name: 'available_qty', precision: 12, scale: 3, nullable: true })
  availableQty: number | null;

  @Column('varchar', { name: 'lot_number', length: 50, nullable: true })
  lotNumber: string | null;

  @Column('date', { name: 'lot_expiry_date', nullable: true })
  lotExpiryDate: Date | null;

  @Column('timestamptz', { name: 'price_list_updated_at', nullable: true })
  priceListUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'last_updated_at', type: 'timestamptz' })
  lastUpdatedAt: Date;

  @ManyToOne(() => SupplierEntity)
  @JoinColumn({ name: 'supplier_id' })
  supplier: SupplierEntity;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;
}
