import { AuthGuard } from '@nestjs/passport';
import { Get, Query, UseGuards, Controller } from '@nestjs/common';

import { PermissionsService } from './permissions.service';

@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'permissions', version: '1' })
export class PermissionsController {
  constructor(private readonly service: PermissionsService) {}

  @Get()
  findAll(@Query('module') module?: string) {
    if (module) return this.service.findByModule(module);
    return this.service.findAll();
  }
}
