import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import {
  QueryStockDto,
  QueryKardexDto,
  CancelCountDto,
  ApproveCountDto,
  QuarantineLotDto,
  CreateAdjustmentDto,
  CountItemUpdateDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
  BulkUpdateCountItemsDto,
  QueryInventoryCountDto,
  CreateInventoryCountDto,
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
  getStock(@Query() query: QueryStockDto) {
    return this.inventoryService.getStock(query);
  }

  @Post('adjustments')
  @ApiOperation({ summary: 'Crear ajuste de inventario (daño, corrección, vencimiento)' })
  createAdjustment(@Body() dto: CreateAdjustmentDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createAdjustment(dto, req.user?.id || 'system');
  }

  @Get('kardex')
  @ApiOperation({ summary: 'Consultar kardex (movimientos inmutables)' })
  findKardex(@Query() query: QueryKardexDto) {
    return this.inventoryService.findKardex(query);
  }

  @Post('counts')
  @ApiOperation({ summary: 'Crear toma de inventario (full / partial / cycle)' })
  createCount(@Body() dto: CreateInventoryCountDto, @Request() req: { user: { id: string } }) {
    return this.inventoryService.createCount(dto, req.user?.id || 'system');
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
