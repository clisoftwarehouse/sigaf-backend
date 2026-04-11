import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import {
  QueryStockDto,
  QueryKardexDto,
  QuarantineLotDto,
  CreateAdjustmentDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
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
}
