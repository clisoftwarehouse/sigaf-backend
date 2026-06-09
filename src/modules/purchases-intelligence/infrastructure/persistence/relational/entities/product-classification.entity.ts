import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Snapshot vigente de la clasificación ABCD por producto+sucursal.
 *
 * Una sola fila por (product_id, branch_id) — se sobrescribe en cada
 * recálculo on-demand. NO se guarda historial detallado en esta tabla
 * (eso queda para auditoría futura con outbox + audit_log general).
 *
 * Score 0-100 ponderado con 5 dimensiones:
 *   rotación 35 + pareto 25 + margen 20 + días inventario 15 + vencimiento 5
 *
 * Reglas duras (PRD §9):
 *   - Productos C que son Pareto → ascenso forzado a B
 *     (`forced_promotion_to_b = true`), require revisión gerencial.
 *   - Vencimiento <90 días → bloqueo de compra (manejado en `suggestion.calculator`,
 *     no acá).
 */
@Index('idx_pc_class', ['branchId', 'abcdClass'])
@Entity('product_classifications')
export class ProductClassificationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('char', { name: 'abcd_class', length: 1 })
  abcdClass: 'A' | 'B' | 'C' | 'D';

  @Column('decimal', { precision: 5, scale: 2 })
  score: number;

  @Column('boolean', { name: 'is_pareto', default: false })
  isPareto: boolean;

  @Column('boolean', { name: 'forced_promotion_to_b', default: false })
  forcedPromotionToB: boolean;

  @Column('decimal', { name: 'daily_velocity', precision: 12, scale: 4, nullable: true })
  dailyVelocity: number | null;

  @Column('decimal', { name: 'days_of_inventory', precision: 8, scale: 2, nullable: true })
  daysOfInventory: number | null;

  @Column('integer', { name: 'days_since_last_sale', nullable: true })
  daysSinceLastSale: number | null;

  @Column('decimal', { name: 'margin_pct', precision: 5, scale: 2, nullable: true })
  marginPct: number | null;

  @Column('decimal', { name: 'seasonal_index_current', precision: 5, scale: 3, nullable: true })
  seasonalIndexCurrent: number | null;

  @Column('varchar', { name: 'expiry_signal', length: 10, nullable: true })
  expirySignal: string | null;

  // Componentes del score (0-1) — preservar trazabilidad de cómo se llegó al score.
  @Column('decimal', { name: 'component_rotation', precision: 4, scale: 3, nullable: true })
  componentRotation: number | null;

  @Column('decimal', { name: 'component_pareto', precision: 4, scale: 3, nullable: true })
  componentPareto: number | null;

  @Column('decimal', { name: 'component_margin', precision: 4, scale: 3, nullable: true })
  componentMargin: number | null;

  @Column('decimal', { name: 'component_inventory_days', precision: 4, scale: 3, nullable: true })
  componentInventoryDays: number | null;

  @Column('decimal', { name: 'component_expiry', precision: 4, scale: 3, nullable: true })
  componentExpiry: number | null;

  @CreateDateColumn({ name: 'calculated_at', type: 'timestamptz' })
  calculatedAt: Date;
}
