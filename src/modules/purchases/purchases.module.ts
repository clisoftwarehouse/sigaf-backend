import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { PricesModule } from '../prices/prices.module';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { GoodsReceiptEntity } from './infrastructure/persistence/relational/entities/goods-receipt.entity';
import { PurchaseOrderEntity } from './infrastructure/persistence/relational/entities/purchase-order.entity';
import { GoodsReceiptItemEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item.entity';
import { PurchaseOrderItemEntity } from './infrastructure/persistence/relational/entities/purchase-order-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrderEntity,
      PurchaseOrderItemEntity,
      GoodsReceiptEntity,
      GoodsReceiptItemEntity,
    ]),
    AuditModule,
    InventoryModule,
    PricesModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService],
  exports: [PurchasesService],
})
export class PurchasesModule {}
