import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PromotionEntity } from './promotion.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

export type PromotionScopeType = 'product' | 'category' | 'branch';

/**
 * Restricción de aplicabilidad de una promoción.
 *
 * Convención:
 *   - Si una promoción no tiene scopes de tipo `product` ni `category`,
 *     aplica a TODOS los productos.
 *   - Si no tiene scopes de tipo `branch`, aplica a TODAS las sucursales.
 *   - Entries de `product` y `category` se combinan con OR (matchea si el
 *     producto aparece directamente O su categoría está listada).
 */
@Entity('promotion_scopes')
@Index('idx_promotion_scopes_lookup', ['scopeType', 'scopeId'])
@Index('idx_promotion_scopes_promotion', ['promotionId'])
export class PromotionScopeEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'promotion_id' })
  promotionId: string;

  @Column('varchar', { name: 'scope_type', length: 20 })
  scopeType: PromotionScopeType;

  @Column('uuid', { name: 'scope_id' })
  scopeId: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PromotionEntity, (p) => p.scopes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion?: PromotionEntity;
}
