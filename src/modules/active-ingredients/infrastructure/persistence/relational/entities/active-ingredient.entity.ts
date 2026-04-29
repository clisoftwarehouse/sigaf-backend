import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';

@Entity('active_ingredients')
export class ActiveIngredientEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 200, unique: true })
  name: string;

  /** FK a `therapeutic_uses` (acción terapéutica). 1:N: cada principio activo tiene UNA acción primaria. */
  @Column('uuid', { name: 'therapeutic_use_id', nullable: true })
  therapeuticUseId: string | null;

  @ManyToOne(() => TherapeuticUseEntity, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'therapeutic_use_id' })
  therapeuticUse: TherapeuticUseEntity | null;

  /** Código ATC (WHO Anatomical Therapeutic Chemical). Ej: "C09CA01" (losartán). */
  @Column('varchar', { name: 'atc_code', length: 20, nullable: true })
  atcCode: string | null;

  /** Denominación Común Internacional (INN / DCI). */
  @Column('varchar', { name: 'inn_name', length: 200, nullable: true })
  innName: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
