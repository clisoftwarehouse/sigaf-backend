import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { PermissionsGuard } from './permissions.guard';
import { PermissionsService } from './permissions.service';
import { PermissionsController } from './permissions.controller';
import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionEntity } from './infrastructure/persistence/relational/entities/role-permission.entity';

// Marcado @Global() para que cualquier controller pueda usar `@UseGuards(PermissionsGuard)`
// y `@RequirePermissions(...)` sin tener que importar PermissionsModule en cada feature
// module. PermissionsGuard inyecta PermissionsService internamente — si no fuera global,
// cada módulo migrado a permisos granulares tendría que importar este módulo, lo que
// duplica imports y rompe los módulos al olvidarlo (caso que acabamos de cazar en
// ProductsModule). El cache TTL evita carga de DB por request.
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([PermissionEntity, RolePermissionEntity])],
  controllers: [PermissionsController],
  providers: [PermissionsService, PermissionsGuard],
  exports: [PermissionsService, PermissionsGuard],
})
export class PermissionsModule {}
