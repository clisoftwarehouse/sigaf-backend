import {
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { BranchGroupEntity } from '@/modules/branch-groups/infrastructure/persistence/relational/entities/branch-group.entity';

@Entity('branches')
export class BranchEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100 })
  name: string;

  @Column('varchar', { length: 20 })
  rif: string;

  @Column('text')
  address: string;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 150, nullable: true })
  email: string | null;

  /**
   * FK al grupo que agrupa esta sucursal. Determina qué matriz de aprobación
   * de OCs aplica (PDF Política OC §1+2). Nullable durante el período de
   * migración; en producción todas las sucursales deberían tener un grupo
   * asignado (al menos el "Sin asignar" creado en la migración).
   */
  @Column('uuid', { name: 'branch_group_id', nullable: true })
  branchGroupId: string | null;

  @ManyToOne(() => BranchGroupEntity, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'branch_group_id' })
  branchGroup: BranchGroupEntity | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
