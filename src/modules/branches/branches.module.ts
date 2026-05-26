import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BranchesService } from './branches.service';
import { BranchesController } from './branches.controller';
import { TerminalsModule } from '@/modules/terminals/terminals.module';
import { BranchEntity } from './infrastructure/persistence/relational/entities/branch.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BranchEntity]), TerminalsModule],
  controllers: [BranchesController],
  providers: [BranchesService],
  exports: [BranchesService],
})
export class BranchesModule {}
