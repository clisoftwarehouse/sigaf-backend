import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { WarehouseLocationEntity } from './infrastructure/persistence/relational/entities/warehouse-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([InventoryLotEntity, KardexEntity, WarehouseLocationEntity]), AuditModule],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
