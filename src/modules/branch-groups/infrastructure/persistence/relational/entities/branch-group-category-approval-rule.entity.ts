import {
  Column,
  Entity,
  Unique,
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
 * Categorías especiales (bandera por producto) que requieren un aprobador
 * adicional independiente del monto. Si un producto en la OC tiene la bandera
 * activa, ese aprobador especial debe firmar (junto con el aprobador por monto).
 *
 * Una fila por (grupo de sucursales, categoría). La unicidad la garantiza el
 * constraint `uq_branch_group_category` definido en la migración.
 */
export type CategoryFlag = 'controlled' | 'antibiotic' | 'cold_chain' | 'imported';

export const CATEGORY_FLAGS: CategoryFlag[] = ['controlled', 'antibiotic', 'cold_chain', 'imported'];

@Entity('branch_group_category_approval_rules')
@Unique('uq_branch_group_category', ['branchGroupId', 'categoryFlag'])
export class BranchGroupCategoryApprovalRuleEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_group_id' })
  branchGroupId: string;

  @ManyToOne(() => BranchGroupEntity, (g) => g.categoryRules, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'branch_group_id' })
  branchGroup: BranchGroupEntity;

  @Column('varchar', { name: 'category_flag', length: 20 })
  categoryFlag: CategoryFlag;

  @Column('uuid', { name: 'role_id' })
  roleId: string;

  @ManyToOne(() => RoleEntity, { eager: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'role_id' })
  role: RoleEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
