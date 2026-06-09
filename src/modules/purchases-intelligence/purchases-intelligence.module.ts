import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConditionsService } from './services/conditions.service';
import { ComparatorService } from './services/comparator.service';
import { SuggestionsService } from './services/suggestions.service';
import { ConditionsController } from './controllers/conditions.controller';
import { ComparatorController } from './controllers/comparator.controller';
import { ClassificationsService } from './services/classifications.service';
import { SuggestionsController } from './controllers/suggestions.controller';
import { ClassificationsController } from './controllers/classifications.controller';
import { LabConditionEntity } from './infrastructure/persistence/relational/entities/lab-condition.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { DrugstoreConditionEntity } from './infrastructure/persistence/relational/entities/drugstore-condition.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductClassificationEntity } from './infrastructure/persistence/relational/entities/product-classification.entity';
import { PurchaseOrderEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/purchase-order.entity';
import { SupplierProductEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier-product.entity';
import { PurchaseOrderItemEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/purchase-order-item.entity';

/**
 * Compras Intelligence — módulo que agrega valor sin tocar el módulo de
 * compras existente. Ver `memory/feedback_purchases_no_regression.md`:
 * todas las features acá son aditivas (tablas nuevas + columnas nullable
 * en supplier_products y purchase_order_items).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      DrugstoreConditionEntity,
      LabConditionEntity,
      ProductClassificationEntity,
      SupplierProductEntity,
      SupplierEntity,
      ProductEntity,
      BranchEntity,
      InventoryLotEntity,
      KardexEntity,
      PurchaseOrderEntity,
      PurchaseOrderItemEntity,
    ]),
  ],
  controllers: [ConditionsController, ComparatorController, ClassificationsController, SuggestionsController],
  providers: [ConditionsService, ComparatorService, ClassificationsService, SuggestionsService],
  exports: [ConditionsService, ComparatorService, ClassificationsService, SuggestionsService],
})
export class PurchasesIntelligenceModule {}
