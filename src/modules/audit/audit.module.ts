import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditLogEntity } from './infrastructure/persistence/relational/entities/audit-log.entity';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity, UserEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
