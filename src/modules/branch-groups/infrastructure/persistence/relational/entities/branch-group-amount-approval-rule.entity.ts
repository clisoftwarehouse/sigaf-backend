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
import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';

import { BranchGroupEntity } from './branch-group.entity';

/**
 * Una fila por (grupo de sucursales, rol) define el rango de monto USD que
 * ese rol puede aprobar dentro del grupo. `maxUsd = NULL` significa "sin tope"
 * (típicamente para gerencia general). El motor elige el rol cuyo rango cubra
 * el total de la OC; los rangos no deben solaparse (validado en el service).
 *
 * Ejemplo grupo "Premium":
 *   - Gerente:    min=0,      max=2.000
 *   - Supervisor: min=2.001,  max=10.000
 *   - Director:   min=10.001, max=NULL
 */
@Entity('branch_group_amount_approval_rules')
export class BranchGroupAmountApprovalRuleEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_group_id' })
  branchGroupId: string;

  @ManyToOne(() => BranchGroupEntity, (g) => g.amountRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_group_id' })
  branchGroup: BranchGroupEntity;

  @Column('uuid', { name: 'role_id' })
  roleId: string;

  @ManyToOne(() => RoleEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @Column('decimal', { name: 'min_usd', precision: 18, scale: 4, default: 0 })
  minUsd: number;

  @Column('decimal', { name: 'max_usd', precision: 18, scale: 4, nullable: true })
  maxUsd: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
