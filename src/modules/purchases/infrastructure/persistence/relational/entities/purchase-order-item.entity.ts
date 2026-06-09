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

  // ─── Snapshot del sugerido al crear OC (Compras Intelligence) ─────────
  // Cuando una OC se genera desde el sugerido, persistimos qué decisión
  // tomó el motor y a qué costo neto, para auditar después si el operador
  // ajustó. Todos nullable para no romper OCs creadas manualmente.

  @Column('varchar', { name: 'decision_at_creation', length: 30, nullable: true })
  decisionAtCreation: string | null;

  @Column('text', { name: 'reason_at_creation', nullable: true })
  reasonAtCreation: string | null;

  @Column('decimal', { name: 'net_cost_usd_snapshot', precision: 18, scale: 4, nullable: true })
  netCostUsdSnapshot: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PurchaseOrderEntity)
  @JoinColumn({ name: 'order_id' })
  order: PurchaseOrderEntity;
}
