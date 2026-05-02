import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { PurchasesService } from './purchases.service';
import { ApprovalEngineService } from './approval-engine.service';
import {
  ReapproveReceiptDto,
  CreateGoodsReceiptDto,
  QueryPurchaseOrderDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto';

@ApiTags('Purchases')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'purchases', version: '1' })
export class PurchasesController {
  constructor(
    private readonly purchasesService: PurchasesService,
    private readonly approvalEngine: ApprovalEngineService,
  ) {}

  // ─── PURCHASE ORDERS ──────────────────────────────────────────────────

  @Get('orders')
  @ApiOperation({ summary: 'Listar órdenes de compra con filtros y paginación' })
  findAllOrders(@Query() query: QueryPurchaseOrderDto) {
    return this.purchasesService.findAllOrders(query);
  }

  @Get('orders/:id')
  @ApiOperation({ summary: 'Obtener orden de compra con ítems' })
  findOneOrder(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.findOneOrder(id);
  }

  @Post('orders')
  @ApiOperation({ summary: 'Crear orden de compra con ítems' })
  createOrder(@Body() dto: CreatePurchaseOrderDto, @Request() req: { user: { id: string } }) {
    return this.purchasesService.createOrder(dto, req.user.id);
  }

  @Put('orders/:id')
  @ApiOperation({ summary: 'Actualizar orden de compra (estado, notas, fecha)' })
  updateOrder(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePurchaseOrderDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.purchasesService.updateOrder(id, dto, req.user.id);
  }

  @Put('orders/:id/approve')
  @ApiOperation({ summary: 'Aprobar orden de compra (draft → sent)' })
  approveOrder(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.purchasesService.approveOrder(id, req.user.id);
  }

  @Get('orders/:id/approval-status')
  @ApiOperation({
    summary: 'Consultar requisitos de aprobación y si el usuario actual puede firmar',
  })
  getApprovalStatus(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.approvalEngine.checkUserCanApprove(id, req.user.id);
  }

  // ─── GOODS RECEIPTS ───────────────────────────────────────────────────

  @Get('receipts')
  @ApiOperation({ summary: 'Listar recepciones de mercancía' })
  findAllReceipts(
    @Query('branchId') branchId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('purchaseOrderId') purchaseOrderId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.purchasesService.findAllReceipts({ branchId, supplierId, purchaseOrderId, from, to });
  }

  @Get('receipts/:id')
  @ApiOperation({ summary: 'Obtener recepción con ítems y lotes creados' })
  findOneReceipt(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchasesService.findOneReceipt(id);
  }

  @Post('receipts')
  @ApiOperation({ summary: 'Crear recepción de mercancía (crea lotes e inserta kardex)' })
  createReceipt(@Body() dto: CreateGoodsReceiptDto, @Request() req: { user: { id: string } }) {
    return this.purchasesService.createReceipt(dto, req.user.id);
  }

  @Put('receipts/:id/reapprove')
  @ApiOperation({
    summary:
      'Reaprueba una recepción bloqueada por exceso de tolerancia (PDF Política OC §5). ' +
      'Crea los lotes pendientes y publica precios.',
  })
  reapproveReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReapproveReceiptDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.purchasesService.reapproveReceipt(id, req.user.id, dto);
  }
}
