import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TherapeuticUsesService } from './therapeutic-uses.service';
import { TherapeuticUsesController } from './therapeutic-uses.controller';
import { ActiveIngredientsModule } from '../active-ingredients/active-ingredients.module';
import { TherapeuticUseEntity } from './infrastructure/persistence/relational/entities/therapeutic-use.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TherapeuticUseEntity]), ActiveIngredientsModule],
  controllers: [TherapeuticUsesController],
  providers: [TherapeuticUsesService],
  exports: [TherapeuticUsesService],
})
export class TherapeuticUsesModule {}
