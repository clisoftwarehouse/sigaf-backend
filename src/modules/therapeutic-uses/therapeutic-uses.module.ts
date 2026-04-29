import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TherapeuticUsesService } from './therapeutic-uses.service';
import { TherapeuticUsesController } from './therapeutic-uses.controller';
import { TherapeuticUseEntity } from './infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TherapeuticUseEntity, ActiveIngredientEntity])],
  controllers: [TherapeuticUsesController],
  providers: [TherapeuticUsesService],
  exports: [TherapeuticUsesService],
})
export class TherapeuticUsesModule {}
