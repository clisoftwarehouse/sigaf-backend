import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('categories')
export class CategoryEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'parent_id', nullable: true })
  parentId: string | null;

  @Column('varchar', { length: 100 })
  name: string;

  @Column('varchar', { length: 20, nullable: true })
  code: string | null;

  @Column('boolean', { name: 'is_pharmaceutical', default: false })
  isPharmaceutical: boolean;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
