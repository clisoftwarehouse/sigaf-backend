import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SalesService } from './sales.service';
import { SalesController } from './sales.controller';
import { PricesModule } from '../prices/prices.module';
import { TerminalsModule } from '../terminals/terminals.module';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { SaleTicketEntity } from './infrastructure/persistence/relational/entities/sale-ticket.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { SaleTicketItemEntity } from './infrastructure/persistence/relational/entities/sale-ticket-item.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SaleTicketPaymentEntity } from './infrastructure/persistence/relational/entities/sale-ticket-payment.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { TerminalTicketCounterEntity } from './infrastructure/persistence/relational/entities/terminal-ticket-counter.entity';
import { CashSessionEntity } from '@/modules/cash-sessions/infrastructure/persistence/relational/entities/cash-session.entity';
import { PrescriptionEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription.entity';
import { CashMovementEntity } from '@/modules/cash-sessions/infrastructure/persistence/relational/entities/cash-movement.entity';
import { PrescriptionItemEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SaleTicketEntity,
      SaleTicketItemEntity,
      SaleTicketPaymentEntity,
      TerminalTicketCounterEntity,
      InventoryLotEntity,
      KardexEntity,
      ProductEntity,
      CashSessionEntity,
      CashMovementEntity,
      PrescriptionEntity,
      PrescriptionItemEntity,
    ]),
    ExchangeRatesModule,
    PricesModule,
    TerminalsModule,
    CqrsModule,
  ],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}
