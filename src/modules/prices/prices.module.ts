import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PricesService } from './prices.service';
import { PricesController } from './prices.controller';
import { PriceEntity } from './infrastructure/persistence/relational/entities/price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceEntity])],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
