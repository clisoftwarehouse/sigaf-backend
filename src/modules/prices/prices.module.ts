import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PricesService } from './prices.service';
import { AuditModule } from '../audit/audit.module';
import { PricesController } from './prices.controller';
import { TerminalsModule } from '../terminals/terminals.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { PriceEntity } from './infrastructure/persistence/relational/entities/price.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PriceEntity, ProductEntity]), AuditModule, ExchangeRatesModule, TerminalsModule],
  controllers: [PricesController],
  providers: [PricesService],
  exports: [PricesService],
})
export class PricesModule {}
