import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { PricesModule } from '../prices/prices.module';
import { PurchasesService } from './purchases.service';
import { PurchasesController } from './purchases.controller';
import { InventoryModule } from '../inventory/inventory.module';
import { ApprovalEngineService } from './approval-engine.service';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
import { GoodsReceiptEntity } from './infrastructure/persistence/relational/entities/goods-receipt.entity';
import { PurchaseOrderEntity } from './infrastructure/persistence/relational/entities/purchase-order.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { GoodsReceiptItemEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { PurchaseOrderItemEntity } from './infrastructure/persistence/relational/entities/purchase-order-item.entity';
import { GlobalConfigEntity } from '@/modules/config-global/infrastructure/persistence/relational/entities/global-config.entity';
import { GoodsReceiptItemDiscrepancyEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item-discrepancy.entity';
import { BranchGroupAmountApprovalRuleEntity } from '@/modules/branch-groups/infrastructure/persistence/relational/entities/branch-group-amount-approval-rule.entity';
import { BranchGroupCategoryApprovalRuleEntity } from '@/modules/branch-groups/infrastructure/persistence/relational/entities/branch-group-category-approval-rule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseOrderEntity,
      PurchaseOrderItemEntity,
      GoodsReceiptEntity,
      GoodsReceiptItemEntity,
      SupplierEntity,
      BranchEntity,
      ProductEntity,
      UserEntity,
      BranchGroupAmountApprovalRuleEntity,
      BranchGroupCategoryApprovalRuleEntity,
      GoodsReceiptItemDiscrepancyEntity,
      GlobalConfigEntity,
    ]),
    AuditModule,
    InventoryModule,
    PricesModule,
    ExchangeRatesModule,
  ],
  controllers: [PurchasesController],
  providers: [PurchasesService, ApprovalEngineService],
  exports: [PurchasesService, ApprovalEngineService],
})
export class PurchasesModule {}
