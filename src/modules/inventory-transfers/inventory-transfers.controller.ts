import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Param,
  Query,
  Delete,
  Request,
  HttpCode,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { InventoryTransfersService } from './inventory-transfers.service';
import {
  CancelTransferDto,
  CreateTransferDto,
  QueryTransfersDto,
  ReceiveTransferDto,
  TransferItemInputDto,
  CreateFromReceiptDto,
} from './dto';

@ApiTags('Inventory Transfers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'inventory-transfers', version: '1' })
export class InventoryTransfersController {
  constructor(private readonly service: InventoryTransfersService) {}

  @Post()
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary:
      'Crear traslado. inter_branch queda en draft; intra_branch se completa al instante (mueve location_id de los lotes).',
  })
  create(@Body() dto: CreateTransferDto, @Request() req: { user: { id: string } }) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Post('from-receipt/:receiptId')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary:
      'Clonar items de un goods_receipt en un nuevo traslado. Caso típico: mover todo lo recibido a Sala de ventas.',
  })
  createFromReceipt(
    @Param('receiptId', ParseUUIDPipe) receiptId: string,
    @Body() dto: CreateFromReceiptDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.createFromReceipt(receiptId, dto, req.user?.id || 'system');
  }

  @Get()
  @ApiOperation({ summary: 'Listar traslados con filtros (tipo, sucursal, almacén, estado, fechas)' })
  findAll(@Query() query: QueryTransfersDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del traslado (con items)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/items')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Agregar item al traslado (solo inter_branch en draft)' })
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferItemInputDto) {
    return this.service.addItem(id, dto);
  }

  @Delete(':id/items/:itemId')
  @Roles(...INVENTORY_WRITERS)
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar item del traslado (solo inter_branch en draft)' })
  removeItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  @Post(':id/dispatch')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Despachar traslado inter_branch: draft → in_transit. Descuenta stock del origen, kardex `transfer_out`.',
  })
  dispatch(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.service.dispatch(id, req.user?.id || 'system');
  }

  @Post(':id/receive')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary:
      'Recibir traslado inter_branch: in_transit → completed. Crea/incrementa lote destino, kardex `transfer_in`. Admite mermas.',
  })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.receive(id, dto, req.user?.id || 'system');
  }

  @Post(':id/cancel')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Cancelar traslado inter_branch. Si in_transit, devuelve stock al origen (kardex `transfer_cancelled`).',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.cancel(id, dto, req.user?.id || 'system');
  }
}
