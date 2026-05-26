import { AuthGuard } from '@nestjs/passport';
import { Get, Query, UseGuards, Controller } from '@nestjs/common';

import { RoleEnum } from '@/modules/roles/roles.enum';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { PermissionsService } from './permissions.service';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(RoleEnum.admin)
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  findAll(@Query('module') module?: string) {
    if (module) return this.service.findByModule(module);
    return this.service.findAll();
  }
}
