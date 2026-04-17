import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VademecumScraperService } from './vademecum-scraper.service';
import { ActiveIngredientsService } from './active-ingredients.service';
import { ActiveIngredientsController } from './active-ingredients.controller';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveIngredientEntity])],
  controllers: [ActiveIngredientsController],
  providers: [ActiveIngredientsService, VademecumScraperService],
  exports: [ActiveIngredientsService, VademecumScraperService],
})
export class ActiveIngredientsModule {}
