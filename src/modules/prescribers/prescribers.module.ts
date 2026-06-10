import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PrescribersService } from './prescribers.service';
import { PrescribersController } from './prescribers.controller';
import { PrescriberEntity } from './infrastructure/persistence/relational/entities/prescriber.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PrescriberEntity])],
  controllers: [PrescribersController],
  providers: [PrescribersService],
  exports: [PrescribersService],
})
export class PrescribersModule {}
