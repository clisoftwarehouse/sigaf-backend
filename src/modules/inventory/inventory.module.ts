import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryJobsService } from './inventory-jobs.service';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCountEntity } from './infrastructure/persistence/relational/entities/inventory-count.entity';
import { WarehouseLocationEntity } from './infrastructure/persistence/relational/entities/warehouse-location.entity';
import { InventoryCountItemEntity } from './infrastructure/persistence/relational/entities/inventory-count-item.entity';
import { InventoryCyclicScheduleEntity } from './infrastructure/persistence/relational/entities/inventory-cyclic-schedule.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryLotEntity,
      KardexEntity,
      WarehouseLocationEntity,
      InventoryCountEntity,
      InventoryCountItemEntity,
      InventoryCyclicScheduleEntity,
      ProductEntity,
    ]),
    AuditModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService, InventoryJobsService],
  exports: [InventoryService],
})
export class InventoryModule {}
