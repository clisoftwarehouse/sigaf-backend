import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { WarehousesService } from './warehouses.service';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { ORG_WRITERS } from '@/modules/roles/roles.constants';
import { QueryWarehouseDto, CreateWarehouseDto, UpdateWarehouseDto } from './dto';

@ApiTags('Warehouses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'warehouses', version: '1' })
export class WarehousesController {
  constructor(private readonly warehousesService: WarehousesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar almacenes' })
  findAll(@Query() query: QueryWarehouseDto) {
    return this.warehousesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.findOne(id);
  }

  @Post()
  @Roles(...ORG_WRITERS)
  @ApiOperation({ summary: 'Crear almacén' })
  create(@Body() dto: CreateWarehouseDto) {
    return this.warehousesService.create(dto);
  }

  @Put(':id')
  @Roles(...ORG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWarehouseDto) {
    return this.warehousesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ORG_WRITERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.warehousesService.remove(id);
  }
}
