import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Condición comercial a nivel de laboratorio (= `brands.is_laboratory = true`).
 *
 * Capas multiplicativas (NO aditivas): lineal (siempre) + escala (cuando
 * compras superan `escalaMinUnits`).
 *
 * `supplierId` opcional: si está seteado, la condición solo aplica cuando
 * se compra ese laboratorio A TRAVÉS de esa droguería específica.
 * `productId` opcional: limita la condición a un SKU del laboratorio.
 */
@Index('idx_lc_brand', ['brandId', 'isActive'])
@Entity('lab_conditions')
export class LabConditionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'brand_id' })
  brandId: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @Column('uuid', { name: 'product_id', nullable: true })
  productId: string | null;

  @Column('decimal', { name: 'lineal_pct', precision: 5, scale: 2, default: 0 })
  linealPct: number;

  @Column('decimal', { name: 'escala_pct', precision: 5, scale: 2, default: 0 })
  escalaPct: number;

  @Column('decimal', { name: 'escala_min_units', precision: 12, scale: 3, nullable: true })
  escalaMinUnits: number | null;

  @Column('date', { name: 'valid_from', default: () => 'CURRENT_DATE' })
  validFrom: Date;

  @Column('date', { name: 'valid_to', nullable: true })
  validTo: Date | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
