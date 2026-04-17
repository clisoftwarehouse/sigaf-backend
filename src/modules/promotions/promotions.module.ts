import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PromotionsService } from './promotions.service';
import { PromotionsController } from './promotions.controller';
import { PromotionEntity } from './infrastructure/persistence/relational/entities/promotion.entity';
import { PromotionScopeEntity } from './infrastructure/persistence/relational/entities/promotion-scope.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PromotionEntity, PromotionScopeEntity])],
  controllers: [PromotionsController],
  providers: [PromotionsService],
  exports: [PromotionsService],
})
export class PromotionsModule {}
