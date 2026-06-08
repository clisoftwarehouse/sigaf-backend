import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WarehousesService } from './warehouses.service';
import { WarehousesController } from './warehouses.controller';
import { WarehouseLocationEntity } from '../inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([WarehouseLocationEntity])],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
