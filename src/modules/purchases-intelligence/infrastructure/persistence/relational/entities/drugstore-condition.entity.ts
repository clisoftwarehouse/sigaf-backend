import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Condición comercial a nivel de droguería.
 *
 * Capas multiplicativas (NO aditivas):
 *   netCost = base * (1 - cabecera) * (1 - volumen) * (1 - prontoPago)
 *
 * El pronto pago es escenario adicional, no se asume por default en el
 * cálculo de margen (PRD §7.2 / §16.2).
 *
 * Scope opcional: si `productId` o `brandId` están seteados, la condición
 * aplica solo a ese subconjunto. Si ambos null → aplica a toda la droguería.
 * Si ambos no-null, gana el más específico (product > brand > droguería).
 */
@Index('idx_dc_supplier', ['supplierId', 'isActive'])
@Entity('drugstore_conditions')
export class DrugstoreConditionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('uuid', { name: 'product_id', nullable: true })
  productId: string | null;

  @Column('uuid', { name: 'brand_id', nullable: true })
  brandId: string | null;

  @Column('decimal', { name: 'cabecera_pct', precision: 5, scale: 2, default: 0 })
  cabeceraPct: number;

  @Column('decimal', { name: 'volumen_pct', precision: 5, scale: 2, default: 0 })
  volumenPct: number;

  @Column('decimal', { name: 'pronto_pago_pct', precision: 5, scale: 2, default: 0 })
  prontoPagoPct: number;

  @Column('decimal', { name: 'volumen_min_usd', precision: 18, scale: 4, nullable: true })
  volumenMinUsd: number | null;

  @Column('decimal', { name: 'volumen_min_units', precision: 12, scale: 3, nullable: true })
  volumenMinUnits: number | null;

  @Column('smallint', { name: 'credit_days', default: 30, nullable: true })
  creditDays: number | null;

  @Column('smallint', { name: 'delivery_days', default: 2, nullable: true })
  deliveryDays: number | null;

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
