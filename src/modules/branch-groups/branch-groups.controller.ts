import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { BranchGroupsService } from './branch-groups.service';
import {
  SetAmountRulesDto,
  AssignBranchesDto,
  SetCategoryRulesDto,
  CreateBranchGroupDto,
  UpdateBranchGroupDto,
} from './dto';

@ApiTags('Branch Groups')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'branch-groups', version: '1' })
export class BranchGroupsController {
  constructor(private readonly service: BranchGroupsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar grupos de sucursales con conteo de sucursales' })
  findAll(@Query('search') search?: string, @Query('isActive') isActive?: string) {
    return this.service.findAll({
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener grupo con reglas y sucursales asignadas' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear grupo de sucursales' })
  create(@Body() dto: CreateBranchGroupDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar grupo' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchGroupDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar grupo (solo si no tiene sucursales asignadas)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Put(':id/amount-rules')
  @ApiOperation({ summary: 'Reemplazar la matriz de aprobación por monto del grupo' })
  setAmountRules(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetAmountRulesDto) {
    return this.service.setAmountRules(id, dto);
  }

  @Put(':id/category-rules')
  @ApiOperation({ summary: 'Reemplazar la matriz de aprobación por categoría especial' })
  setCategoryRules(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetCategoryRulesDto) {
    return this.service.setCategoryRules(id, dto);
  }

  @Post(':id/branches')
  @ApiOperation({ summary: 'Asignar sucursales al grupo' })
  assignBranches(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AssignBranchesDto) {
    return this.service.assignBranches(id, dto);
  }
}
