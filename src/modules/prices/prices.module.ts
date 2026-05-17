import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PricesService } from './prices.service';
import { AuditModule } from '../audit/audit.module';
import { PricesController } from './prices.controller';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { PriceEntity } from './infrastructure/persistence/relational/entities/price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceEntity]), AuditModule, ExchangeRatesModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
