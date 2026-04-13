import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { ConsignmentsService } from './consignments.service';
import { InventoryModule } from '../inventory/inventory.module';
import { ConsignmentsController } from './consignments.controller';
import { ConsignmentEntryEntity } from './infrastructure/persistence/relational/entities/consignment-entry.entity';
import { ConsignmentReturnEntity } from './infrastructure/persistence/relational/entities/consignment-return.entity';
import { ConsignmentEntryItemEntity } from './infrastructure/persistence/relational/entities/consignment-entry-item.entity';
import { ConsignmentReturnItemEntity } from './infrastructure/persistence/relational/entities/consignment-return-item.entity';
import { ConsignmentLiquidationEntity } from './infrastructure/persistence/relational/entities/consignment-liquidation.entity';
import { ConsignmentLiquidationItemEntity } from './infrastructure/persistence/relational/entities/consignment-liquidation-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ConsignmentEntryEntity,
      ConsignmentEntryItemEntity,
      ConsignmentLiquidationEntity,
      ConsignmentLiquidationItemEntity,
      ConsignmentReturnEntity,
      ConsignmentReturnItemEntity,
    ]),
    AuditModule,
    InventoryModule,
  ],
  controllers: [ConsignmentsController],
  providers: [ConsignmentsService],
  exports: [ConsignmentsService],
})
export class ConsignmentsModule {}
