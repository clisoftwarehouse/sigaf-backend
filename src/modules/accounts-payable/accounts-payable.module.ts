import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PaymentsService } from './services/payments.service';
import { AccountsPayableService } from './services/accounts-payable.service';
import { AccountsPayableController } from './controllers/accounts-payable.controller';
import { AccountsPayableEntity } from './infrastructure/persistence/relational/entities/accounts-payable.entity';
import { GoodsReceiptEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';
import { AccountsPayablePaymentEntity } from './infrastructure/persistence/relational/entities/accounts-payable-payment.entity';

/**
 * Cuentas por Pagar — módulo aditivo. NO modifica nada del módulo de
 * compras. Se engancha a la aprobación de recepciones via hook (try/catch)
 * para auto-crear CxP — si falla, la recepción sigue aprobada.
 */
@Module({
  imports: [TypeOrmModule.forFeature([AccountsPayableEntity, AccountsPayablePaymentEntity, GoodsReceiptEntity])],
  controllers: [AccountsPayableController],
  providers: [AccountsPayableService, PaymentsService],
  exports: [AccountsPayableService, PaymentsService],
})
export class AccountsPayableModule {}
