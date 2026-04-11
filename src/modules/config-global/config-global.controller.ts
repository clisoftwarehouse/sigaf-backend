import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Request, UseGuards, Controller } from '@nestjs/common';

import { ConfigGlobalService } from './config-global.service';

@ApiTags('Config Global')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'config', version: '1' })
export class ConfigGlobalController {
  constructor(private readonly service: ConfigGlobalService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener configuración global (IVA, IGTF, tasas BCV)' })
  findAll() {
    return this.service.findAll();
  }

  @Put()
  @ApiOperation({ summary: 'Actualizar configuración global' })
  update(@Body() data: Record<string, string>, @Request() req: { user: { id: string } }) {
    return this.service.setMany(data, req.user?.id);
  }
}
