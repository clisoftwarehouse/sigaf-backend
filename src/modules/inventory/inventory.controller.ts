import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import {
  QueryStockDto,
  ConsumeFefoDto,
  QueryKardexDto,
  CancelCountDto,
  RecountItemDto,
  ReturnToLotDto,
  ApproveCountDto,
  QueryAccuracyDto,
  QuarantineLotDto,
  CountItemUpdateDto,
  CreateAdjustmentDto,
  QueryStockDetailDto,
  QueryAdjustmentsDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
  QueryInventoryCountDto,
  QueryCyclicScheduleDto,
  BulkUpdateCountItemsDto,
  CreateInventoryCountDto,
  CreateCyclicScheduleDto,
  UpdateCyclicScheduleDto,
  QueryCostOfSalePreviewDto,
} from './dto';

@ApiTags('Inventory')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'inventory', version: '1' })
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('lots')
  @ApiOperation({ summary: 'Listar lotes de inventario con filtros y paginación' })
  findAllLots(@Query() query: QueryInventoryLotDto) {
    return this.inventoryService.findAllLots(query);
  }

  @Get('lots/:id')
  findOneLot(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOneLot(id);
  }

  @Post('lots')
  @ApiOperation({ summary: 'Crear nuevo lote de inventario' })
  createLot(@Body() dto: CreateInventoryLotDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createLot(dto, req.user?.id || 'system');
  }

  @Put('lots/:id')
  updateLot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInventoryLotDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.updateLot(id, dto, req.user?.id || 'system');
  }

  @Put('lots/:id/quarantine')
  @ApiOperation({ summary: 'Establecer/quitar cuarentena de un lote' })
  setQuarantine(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: QuarantineLotDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.setQuarantine(id, dto, req.user?.id || 'system');
  }

  @Get('stock-fefo')
  @ApiOperation({ summary: 'Obtener stock ordenado por FEFO (First Expire First Out)' })
  getStockFefo(@Query('productId') productId?: string, @Query('branchId') branchId?: string) {
    return this.inventoryService.getStockFefo({ productId, branchId });
  }

  @Get('stock')
  @ApiOperation({ summary: 'Stock agregado por producto/sucursal (enriquecido con reservado y último conteo)' })
  getStock(@Query() query: QueryStockDto) {
    return this.inventoryService.getStock(query);
  }

  @Get('stock/:productId')
  @ApiOperation({
    summary:
      'Detalle unificado de stock del producto (Stock ↔ Lotes ↔ Kardex): resumen por sucursal + lotes con movimientos recientes',
  })
  getStockDetail(@Param('productId', ParseUUIDPipe) productId: string, @Query() query: QueryStockDetailDto) {
    return this.inventoryService.getStockDetail(productId, query);
  }

  @Post('adjustments')
  @ApiOperation({
    summary: 'Crear ajuste de inventario positivo o negativo (daño, corrección, count_difference, expiry_write_off)',
  })
  createAdjustment(@Body() dto: CreateAdjustmentDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createAdjustment(dto, req.user?.id || 'system');
  }

  @Get('adjustments')
  @ApiOperation({ summary: 'Listar ajustes de inventario previos (kardex filtrado por reference_type=adjustment)' })
  getAdjustments(@Query() query: QueryAdjustmentsDto) {
    return this.inventoryService.getAdjustments(query);
  }

  @Get('kardex')
  @ApiOperation({ summary: 'Consultar kardex (movimientos inmutables)' })
  findKardex(@Query() query: QueryKardexDto) {
    return this.inventoryService.findKardex(query);
  }

  // ─── Costo de venta (FEFO + COGS) ──────────────────────────────────────────

  @Get('cost-of-sale/preview')
  @ApiOperation({
    summary: 'Preview FEFO: lotes a consumir + COGS (sin persistir). Si se pasa salePriceUsd calcula margen.',
  })
  previewCostOfSale(@Query() query: QueryCostOfSalePreviewDto, @Query('salePriceUsd') salePriceUsd?: string) {
    const price = salePriceUsd != null ? parseFloat(salePriceUsd) : undefined;
    return this.inventoryService.previewCostOfSale(query, Number.isFinite(price) ? price : undefined);
  }

  @Post('cost-of-sale/consume')
  @ApiOperation({
    summary:
      'Consume stock FEFO (transaccional): decrementa lotes, incrementa quantity_sold y genera kardex sale_out por cada lote. Retorna plan + COGS.',
  })
  consumeFefo(@Body() dto: ConsumeFefoDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.consumeFefo(dto, req.user?.id || 'system');
  }

  @Post('cost-of-sale/return')
  @ApiOperation({
    summary:
      'Devuelve mercancía a un lote específico (revierte un consumo previo). Genera kardex return_in con el unit_cost del lote.',
  })
  returnToLot(@Body() dto: ReturnToLotDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.returnToLot(dto, req.user?.id || 'system');
  }

  @Get('counts/accuracy')
  @ApiOperation({ summary: 'Métricas de precisión de tomas aprobadas' })
  getAccuracy(@Query() query: QueryAccuracyDto) {
    return this.inventoryService.getAccuracy(query);
  }

  @Get('counts/cyclic-schedules')
  @ApiOperation({ summary: 'Listar programas de conteo cíclico' })
  findCyclicSchedules(@Query() query: QueryCyclicScheduleDto) {
    return this.inventoryService.findCyclicSchedules(query);
  }

  @Post('counts/cyclic-schedules')
  @ApiOperation({ summary: 'Crear programa de conteo cíclico (clases ABC / niveles de riesgo)' })
  createCyclicSchedule(@Body() dto: CreateCyclicScheduleDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createCyclicSchedule(dto, req.user?.id || 'system');
  }

  @Put('counts/cyclic-schedules/:id')
  @ApiOperation({ summary: 'Actualizar programa de conteo cíclico' })
  updateCyclicSchedule(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCyclicScheduleDto) {
    return this.inventoryService.updateCyclicSchedule(id, dto);
  }

  @Post('counts')
  @ApiOperation({ summary: 'Crear toma de inventario (full / partial / cycle)' })
  createCount(@Body() dto: CreateInventoryCountDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createCount(dto, req.user?.id || 'system');
  }

  @Put('counts/:id/start')
  @ApiOperation({ summary: 'Iniciar toma (draft → in_progress, bloquea SKUs si blocksSales)' })
  startCount(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.inventoryService.startCount(id, req.user?.id || 'system');
  }

  @Get('counts')
  @ApiOperation({ summary: 'Listar tomas de inventario con filtros y paginación' })
  findAllCounts(@Query() query: QueryInventoryCountDto) {
    return this.inventoryService.findAllCounts(query);
  }

  @Get('counts/:id')
  @ApiOperation({ summary: 'Obtener detalle de toma (con items)' })
  findOneCount(@Param('id', ParseUUIDPipe) id: string) {
    return this.inventoryService.findOneCount(id);
  }

  @Put('counts/:id/items/:itemId')
  @ApiOperation({ summary: 'Registrar cantidad contada para un item' })
  updateCountItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: CountItemUpdateDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.updateCountItem(id, itemId, dto, req.user?.id || 'system');
  }

  @Put('counts/:id/items')
  @ApiOperation({ summary: 'Registrar cantidades contadas en lote' })
  bulkUpdateCountItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkUpdateCountItemsDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.bulkUpdateCountItems(id, dto, req.user?.id || 'system');
  }

  @Put('counts/:id/items/:itemId/recount')
  @ApiOperation({ summary: 'Marcar item para recuento (limpia conteo previo)' })
  recountCountItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: RecountItemDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.recountCountItem(id, itemId, dto, req.user?.id || 'system');
  }

  @Post('counts/:id/complete')
  @ApiOperation({ summary: 'Marcar toma como completada (todos los items contados)' })
  completeCount(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.inventoryService.completeCount(id, req.user?.id || 'system');
  }

  @Post('counts/:id/approve')
  @ApiOperation({ summary: 'Aprobar toma — genera ajustes y mueve kardex' })
  approveCount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApproveCountDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.approveCount(id, dto, req.user?.id || 'system');
  }

  @Post('counts/:id/cancel')
  @ApiOperation({ summary: 'Cancelar toma de inventario' })
  cancelCount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelCountDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.inventoryService.cancelCount(id, dto, req.user?.id || 'system');
  }
}
