import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Catálogo de variantes comerciales (tipo / sub-variante). QA #93:
 * convierte el string libre `products.commercial_variant` en un dato
 * reutilizable con FK.
 *
 * Ej: "Crema Dental", "Champú Anticaspa", "Pañal Talla M".
 */
@Entity('commercial_variants')
export class CommercialVariantEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 120, unique: true })
  name: string;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
