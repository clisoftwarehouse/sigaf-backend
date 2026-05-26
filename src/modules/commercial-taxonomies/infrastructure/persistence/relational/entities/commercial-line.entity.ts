import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Catálogo de líneas comerciales (sub-marcas). QA #93: convierte el string
 * libre `products.commercial_line` en un dato reutilizable con FK.
 *
 * Ej: "Total 12", "Colgate Triple Action", "Pampers Premium Care".
 */
@Entity('commercial_lines')
export class CommercialLineEntity extends EntityRelationalHelper {
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
