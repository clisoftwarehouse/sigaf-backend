import { Index, Column, Entity, UpdateDateColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Precio de venta vigente (o histórico) de un producto.
 *
 * - Siempre en USD. La conversión a Bs la hace el POS al momento de imprimir
 *   usando `exchange_rates` — jamás se persiste un precio en Bs.
 * - `branchId = null` → precio global; `branchId` seteado → override por sucursal.
 * - `effectiveTo = null` → precio vigente; con valor → histórico.
 * - Solo puede existir UN precio vigente por scope (producto + sucursal|null),
 *   garantizado por el unique index parcial `ux_prices_active_scope`.
 */
@Entity('prices')
@Index('idx_prices_product_effective', ['productId', 'effectiveFrom'])
export class PriceEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column('decimal', { name: 'price_usd', precision: 18, scale: 4 })
  priceUsd: number;

  @Column('timestamptz', { name: 'effective_from' })
  effectiveFrom: Date;

  @Column('timestamptz', { name: 'effective_to', nullable: true })
  effectiveTo: Date | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
