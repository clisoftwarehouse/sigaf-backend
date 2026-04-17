import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('active_ingredients')
export class ActiveIngredientEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200, unique: true })
  name: string;

  @Column('varchar', { name: 'therapeutic_group', length: 100, nullable: true })
  therapeuticGroup: string | null;

  /** Código ATC (WHO Anatomical Therapeutic Chemical). Ej: "C09CA01" (losartán). */
  @Column('varchar', { name: 'atc_code', length: 20, nullable: true })
  atcCode: string | null;

  /** Denominación Común Internacional (INN / DCI). */
  @Column('varchar', { name: 'inn_name', length: 200, nullable: true })
  innName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
