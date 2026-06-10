import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TerminalsModule } from '../terminals/terminals.module';
import { ClinicalProfileService } from './clinical-profile.service';
import { CustomerEntity } from './infrastructure/persistence/relational/entities/customer.entity';
import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';
import { PrescriptionEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity, SaleTicketEntity, PrescriptionEntity]), TerminalsModule],
  controllers: [CustomersController],
  providers: [CustomersService, ClinicalProfileService],
  exports: [CustomersService],
})
export class CustomersModule {}
