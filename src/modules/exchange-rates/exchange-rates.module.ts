import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BcvScraperService } from './bcv-scraper.service';
import { ExchangeRatesService } from './exchange-rates.service';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRateEntity } from './infrastructure/persistence/relational/entities/exchange-rate.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ExchangeRateEntity])],
  controllers: [ExchangeRatesController],
  providers: [ExchangeRatesService, BcvScraperService],
  exports: [ExchangeRatesService],
})
export class ExchangeRatesModule {}
