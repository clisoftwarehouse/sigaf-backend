import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditModule } from '../audit/audit.module';
import { ClaimsService } from './claims.service';
import { ClaimsController } from './claims.controller';
import { SupplierClaimEntity } from './infrastructure/persistence/relational/entities/supplier-claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierClaimEntity]), AuditModule],
  controllers: [ClaimsController],
  providers: [ClaimsService],
  exports: [ClaimsService],
})
export class ClaimsModule {}
