import { Column, Entity, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('global_config')
export class GlobalConfigEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100, unique: true })
  key: string;

  @Column('text')
  value: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('varchar', { name: 'data_type', length: 20, default: 'string' })
  dataType: string;

  @Column('uuid', { name: 'updated_by', nullable: true })
  updatedBy: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
