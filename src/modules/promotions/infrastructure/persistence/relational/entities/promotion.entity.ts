import { Index, Column, Entity, OneToMany, UpdateDateColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PromotionScopeEntity } from './promotion-scope.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

export type PromotionType = 'percentage' | 'fixed_amount' | 'buy_x_get_y';

/**
 * Promoción / descuento aplicable a productos.
 *
 * Semántica de `value` según `type`:
 *   - `percentage`   → % de descuento (0 < value <= 100)
 *   - `fixed_amount` → USD a descontar por unidad
 *   - `buy_x_get_y`  → value no se usa; se usan `buyQuantity` y `getQuantity`
 *
 * Todos los montos en USD, nunca en Bs (la conversión a Bs la hace el POS).
 */
@Entity('promotions')
@Index('idx_promotions_priority', ['priority'])
export class PromotionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200 })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('varchar', { length: 20 })
  type: PromotionType;

  @Column('decimal', { precision: 18, scale: 4, default: 0 })
  value: number;

  @Column('integer', { name: 'buy_quantity', nullable: true })
  buyQuantity: number | null;

  @Column('integer', { name: 'get_quantity', nullable: true })
  getQuantity: number | null;

  @Column('decimal', { name: 'min_quantity', precision: 12, scale: 3, default: 1 })
  minQuantity: number;

  @Column('integer', { name: 'max_uses', nullable: true })
  maxUses: number | null;

  @Column('integer', { name: 'uses_count', default: 0 })
  usesCount: number;

  @Column('integer', { default: 0 })
  priority: number;

  @Column('boolean', { default: false })
  stackable: boolean;

  @Column('timestamptz', { name: 'effective_from' })
  effectiveFrom: Date;

  @Column('timestamptz', { name: 'effective_to', nullable: true })
  effectiveTo: Date | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PromotionScopeEntity, (scope) => scope.promotion, { cascade: false })
  scopes?: PromotionScopeEntity[];
}
