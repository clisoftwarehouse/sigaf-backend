import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { ConsignmentsService } from './consignments.service';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import {
  QueryConsignmentDto,
  CreateConsignmentEntryDto,
  CreateConsignmentReturnDto,
  CreateConsignmentLiquidationDto,
} from './dto';

@ApiTags('Consignments')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'consignments', version: '1' })
export class ConsignmentsController {
  constructor(private readonly consignmentsService: ConsignmentsService) {}

  // ─── ENTRIES ───────────────────────────────────────────────────────────

  @Get('entries')
  @ApiOperation({ summary: 'Listar entradas de consignación' })
  findAllEntries(@Query() query: QueryConsignmentDto) {
    return this.consignmentsService.findAllEntries(query);
  }

  @Get('entries/:id')
  @ApiOperation({ summary: 'Obtener entrada de consignación con ítems' })
  findOneEntry(@Param('id', ParseUUIDPipe) id: string) {
    return this.consignmentsService.findOneEntry(id);
  }

  @Post('entries')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear entrada de consignación (crea lotes en inventario)' })
  createEntry(@Body() dto: CreateConsignmentEntryDto, @Request() req: { user: { id: string } }) {
    return this.consignmentsService.createEntry(dto, req.user.id);
  }

  // ─── RETURNS ───────────────────────────────────────────────────────────

  @Get('returns')
  @ApiOperation({ summary: 'Listar devoluciones de consignación' })
  findAllReturns(
    @Query('branchId') branchId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('consignmentEntryId') consignmentEntryId?: string,
  ) {
    return this.consignmentsService.findAllReturns({ branchId, supplierId, consignmentEntryId });
  }

  @Post('returns')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Devolver ítems de consignación al proveedor' })
  createReturn(@Body() dto: CreateConsignmentReturnDto, @Request() req: { user: { id: string } }) {
    return this.consignmentsService.createReturn(dto, req.user.id);
  }

  // ─── LIQUIDATIONS ─────────────────────────────────────────────────────

  @Get('liquidations')
  @ApiOperation({ summary: 'Listar liquidaciones de consignación' })
  findAllLiquidations(
    @Query('branchId') branchId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('status') status?: string,
  ) {
    return this.consignmentsService.findAllLiquidations({ branchId, supplierId, status });
  }

  @Get('liquidations/:id')
  @ApiOperation({ summary: 'Obtener liquidación con ítems' })
  findOneLiquidation(@Param('id', ParseUUIDPipe) id: string) {
    return this.consignmentsService.findOneLiquidation(id);
  }

  @Post('liquidations')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Generar liquidación de consignación (calcula comisiones)' })
  createLiquidation(@Body() dto: CreateConsignmentLiquidationDto, @Request() req: { user: { id: string } }) {
    return this.consignmentsService.createLiquidation(dto, req.user.id);
  }

  @Put('liquidations/:id/approve')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Aprobar liquidación (draft → approved)' })
  approveLiquidation(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.consignmentsService.approveLiquidation(id, req.user.id);
  }
}
