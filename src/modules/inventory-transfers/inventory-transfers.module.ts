import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { InventoryTransfersService } from './inventory-transfers.service';
import { InventoryTransfersController } from './inventory-transfers.controller';
import { KardexEntity } from '../inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryTransferEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer.entity';
import { InventoryTransferItemEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryTransferEntity, InventoryTransferItemEntity, InventoryLotEntity, KardexEntity]),
  ],
  controllers: [InventoryTransfersController],
  providers: [InventoryTransfersService],
  exports: [InventoryTransfersService],
})
export class InventoryTransfersModule {}
