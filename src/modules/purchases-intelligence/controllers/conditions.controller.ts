import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { ConditionsService } from '../services/conditions.service';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import {
  QueryLabConditionsDto,
  CreateLabConditionDto,
  UpdateLabConditionDto,
  QueryDrugstoreConditionsDto,
  CreateDrugstoreConditionDto,
  UpdateDrugstoreConditionDto,
} from '../dto';

/**
 * Endpoints de configuración del motor: condiciones por droguería y
 * laboratorio. Las consume el `comparator.service` y el motor de costo
 * neto para rankear opciones de compra.
 */
@ApiTags('Purchases Intelligence — Conditions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'purchases-intelligence/conditions', version: '1' })
export class ConditionsController {
  constructor(private readonly service: ConditionsService) {}

  // ─── Drugstore ──────────────────────────────────────────────────────

  @Get('drugstore')
  @ApiOperation({ summary: 'Listar condiciones de droguería con filtros opcionales.' })
  findAllDrugstore(@Query() query: QueryDrugstoreConditionsDto) {
    return this.service.findAllDrugstore(query);
  }

  @Get('drugstore/:id')
  @ApiOperation({ summary: 'Detalle de una condición de droguería.' })
  findOneDrugstore(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneDrugstore(id);
  }

  @Post('drugstore')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear condición de droguería (cabecera, volumen, pronto pago).' })
  createDrugstore(@Body() dto: CreateDrugstoreConditionDto) {
    return this.service.createDrugstore(dto);
  }

  @Put('drugstore/:id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Actualizar condición de droguería.' })
  updateDrugstore(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDrugstoreConditionDto) {
    return this.service.updateDrugstore(id, dto);
  }

  @Delete('drugstore/:id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Desactivar condición de droguería (soft-delete: isActive=false, preserva historial).',
  })
  removeDrugstore(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeDrugstore(id);
  }

  // ─── Lab ────────────────────────────────────────────────────────────

  @Get('lab')
  @ApiOperation({ summary: 'Listar condiciones de laboratorio con filtros opcionales.' })
  findAllLab(@Query() query: QueryLabConditionsDto) {
    return this.service.findAllLab(query);
  }

  @Get('lab/:id')
  @ApiOperation({ summary: 'Detalle de una condición de laboratorio.' })
  findOneLab(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneLab(id);
  }

  @Post('lab')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear condición de laboratorio (lineal, escala).' })
  createLab(@Body() dto: CreateLabConditionDto) {
    return this.service.createLab(dto);
  }

  @Put('lab/:id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Actualizar condición de laboratorio.' })
  updateLab(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLabConditionDto) {
    return this.service.updateLab(id, dto);
  }

  @Delete('lab/:id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Desactivar condición de laboratorio (soft-delete: isActive=false).',
  })
  removeLab(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeLab(id);
  }
}
