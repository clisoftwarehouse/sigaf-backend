import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('therapeutic_uses')
export class TherapeuticUseEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200, unique: true })
  name: string;

  @Column('varchar', { length: 500, nullable: true })
  description: string | null;

  /** Código ATC nivel 1-3 (WHO). Ej: "C09" = Agentes que actúan sobre renina-angiotensina. */
  @Column('varchar', { name: 'atc_code', length: 20, nullable: true })
  atcCode: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
