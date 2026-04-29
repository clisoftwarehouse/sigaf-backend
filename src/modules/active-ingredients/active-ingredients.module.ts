import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { VademecumScraperService } from './vademecum-scraper.service';
import { ActiveIngredientsService } from './active-ingredients.service';
import { ActiveIngredientsController } from './active-ingredients.controller';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ProductActiveIngredientEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-active-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveIngredientEntity, TherapeuticUseEntity, ProductActiveIngredientEntity])],
  controllers: [ActiveIngredientsController],
  providers: [ActiveIngredientsService, VademecumScraperService],
  exports: [ActiveIngredientsService, VademecumScraperService],
})
export class ActiveIngredientsModule {}
