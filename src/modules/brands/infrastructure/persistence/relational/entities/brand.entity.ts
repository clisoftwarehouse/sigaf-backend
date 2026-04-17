import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Las marcas se manejan de forma simplificada: solo su descripción (`name`) y
 * si corresponde a un laboratorio farmacéutico. Los datos fiscales/contacto
 * viven en `suppliers`/`supplier_contacts`.
 */
@Entity('brands')
export class BrandEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100, unique: true })
  name: string;

  @Column('boolean', { name: 'is_laboratory', default: false })
  isLaboratory: boolean;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
