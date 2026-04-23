import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DemoSeedService } from './demo-seed.service';
import { BrandEntity } from '@/modules/brands/infrastructure/persistence/relational/entities/brand.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';
import { CategoryEntity } from '@/modules/categories/infrastructure/persistence/relational/entities/category.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductBarcodeEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-barcode.entity';
import { ExchangeRateEntity } from '@/modules/exchange-rates/infrastructure/persistence/relational/entities/exchange-rate.entity';
import { WarehouseLocationEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';
import { ProductActiveIngredientEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-active-ingredient.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BranchEntity,
      SupplierEntity,
      BrandEntity,
      CategoryEntity,
      ActiveIngredientEntity,
      ProductEntity,
      ProductBarcodeEntity,
      ProductActiveIngredientEntity,
      TerminalEntity,
      WarehouseLocationEntity,
      ExchangeRateEntity,
      InventoryLotEntity,
      KardexEntity,
    ]),
  ],
  providers: [DemoSeedService],
  exports: [DemoSeedService],
})
export class DemoSeedModule {}
