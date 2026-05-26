import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrescriptionsService } from './prescriptions.service';
import { TerminalsModule } from '../terminals/terminals.module';
import { PrescriptionsController } from './prescriptions.controller';
import { PrescriptionEntity } from './infrastructure/persistence/relational/entities/prescription.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { PrescriptionItemEntity } from './infrastructure/persistence/relational/entities/prescription-item.entity';
import { CustomerEntity } from '@/modules/customers/infrastructure/persistence/relational/entities/customer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([PrescriptionEntity, PrescriptionItemEntity, CustomerEntity, ProductEntity]),
    TerminalsModule,
  ],
  controllers: [PrescriptionsController],
  providers: [PrescriptionsService],
  exports: [PrescriptionsService],
})
export class PrescriptionsModule {}
