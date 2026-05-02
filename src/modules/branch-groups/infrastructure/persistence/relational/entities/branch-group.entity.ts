import { Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { BranchGroupAmountApprovalRuleEntity } from './branch-group-amount-approval-rule.entity';
import { BranchGroupCategoryApprovalRuleEntity } from './branch-group-category-approval-rule.entity';

@Entity('branch_groups')
export class BranchGroupEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100, unique: true })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => BranchGroupAmountApprovalRuleEntity, (r) => r.branchGroup, { cascade: true })
  amountRules: BranchGroupAmountApprovalRuleEntity[];

  @OneToMany(() => BranchGroupCategoryApprovalRuleEntity, (r) => r.branchGroup, { cascade: true })
  categoryRules: BranchGroupCategoryApprovalRuleEntity[];
}
