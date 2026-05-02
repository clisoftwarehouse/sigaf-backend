import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';

import { BranchGroupsService } from './branch-groups.service';
import { BranchGroupsController } from './branch-groups.controller';
import { BranchGroupEntity } from './infrastructure/persistence/relational/entities/branch-group.entity';
import { BranchGroupAmountApprovalRuleEntity } from './infrastructure/persistence/relational/entities/branch-group-amount-approval-rule.entity';
import { BranchGroupCategoryApprovalRuleEntity } from './infrastructure/persistence/relational/entities/branch-group-category-approval-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BranchGroupEntity,
      BranchGroupAmountApprovalRuleEntity,
      BranchGroupCategoryApprovalRuleEntity,
      BranchEntity,
    ]),
  ],
  controllers: [BranchGroupsController],
  providers: [BranchGroupsService],
  exports: [BranchGroupsService],
})
export class BranchGroupsModule {}
