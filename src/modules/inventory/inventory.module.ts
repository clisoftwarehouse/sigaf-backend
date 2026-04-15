import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCountEntity } from './infrastructure/persistence/relational/entities/inventory-count.entity';
import { WarehouseLocationEntity } from './infrastructure/persistence/relational/entities/warehouse-location.entity';
import { InventoryCountItemEntity } from './infrastructure/persistence/relational/entities/inventory-count-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLotEntity,
      KardexEntity,
      WarehouseLocationEntity,
      InventoryCountEntity,
      InventoryCountItemEntity,
      ProductEntity,
    ]),
    AuditModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
