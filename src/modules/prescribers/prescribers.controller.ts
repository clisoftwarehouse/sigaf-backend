import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Body,
  Post,
  Query,
  Param,
  Delete,
  Request,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { PrescribersService } from './prescribers.service';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { CreatePrescriberDto, QueryPrescribersDto, UpdatePrescriberDto } from './dto';

@ApiTags('Prescribers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'prescribers', version: '1' })
export class PrescribersController {
  constructor(private readonly service: PrescribersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar médicos con búsqueda y paginación' })
  findAll(@Query() query: QueryPrescribersDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un médico' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear médico' })
  create(@Body() dto: CreatePrescriberDto, @Request() req: { user: { id: string } }) {
    return this.service.create(dto, req.user?.id ?? 'system');
  }

  @Put(':id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Actualizar médico' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescriberDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Desactivar médico (soft delete)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }
}
