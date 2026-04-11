import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionSeedService } from './permission-seed.service';
import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/permission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity, RoleEntity])],
  providers: [PermissionSeedService],
  exports: [PermissionSeedService],
})
export class PermissionSeedModule {}
