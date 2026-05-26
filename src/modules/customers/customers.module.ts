import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CustomersService } from './customers.service';
import { CustomersController } from './customers.controller';
import { TerminalsModule } from '../terminals/terminals.module';
import { CustomerEntity } from './infrastructure/persistence/relational/entities/customer.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CustomerEntity]), TerminalsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
