import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ActiveIngredientsService } from './active-ingredients.service';
import { ActiveIngredientsController } from './active-ingredients.controller';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveIngredientEntity])],
  controllers: [ActiveIngredientsController],
  providers: [ActiveIngredientsService],
  exports: [ActiveIngredientsService],
})
export class ActiveIngredientsModule {}
