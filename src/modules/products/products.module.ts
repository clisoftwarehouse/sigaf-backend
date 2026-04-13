import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { ProductsService } from './products.service';
import { ProductsController } from './products.controller';
import { ProductEntity } from './infrastructure/persistence/relational/entities/product.entity';
import { ProductBarcodeEntity } from './infrastructure/persistence/relational/entities/product-barcode.entity';
import { ProductSubstituteEntity } from './infrastructure/persistence/relational/entities/product-substitute.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductActiveIngredientEntity } from './infrastructure/persistence/relational/entities/product-active-ingredient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductEntity,
      ProductBarcodeEntity,
      ProductSubstituteEntity,
      ProductActiveIngredientEntity,
      InventoryLotEntity,
    ]),
    AuditModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
