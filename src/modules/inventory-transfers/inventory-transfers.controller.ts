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

import { InventoryTransfersService } from './inventory-transfers.service';
import {
  CancelTransferDto,
  CreateTransferDto,
  QueryTransfersDto,
  ReceiveTransferDto,
  TransferItemInputDto,
} from './dto';

@ApiTags('Inventory Transfers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'inventory-transfers', version: '1' })
export class InventoryTransfersController {
  constructor(private readonly service: InventoryTransfersService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear traslado (draft). Valida stock en origen pero no mueve nada hasta el dispatch.',
  })
  create(@Body() dto: CreateTransferDto, @Request() req: { user: { id: string } }) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  @ApiOperation({ summary: 'Listar traslados con filtros (sucursal, estado, rango de fechas)' })
  findAll(@Query() query: QueryTransfersDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle del traslado (con items)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/items')
  @ApiOperation({ summary: 'Agregar item al traslado (solo en draft)' })
  addItem(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TransferItemInputDto) {
    return this.service.addItem(id, dto);
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar item del traslado (solo en draft)' })
  removeItem(@Param('id', ParseUUIDPipe) id: string, @Param('itemId', ParseUUIDPipe) itemId: string) {
    return this.service.removeItem(id, itemId);
  }

  @Post(':id/dispatch')
  @ApiOperation({
    summary:
      'Despachar traslado: draft → in_transit. Descuenta stock del origen, genera kardex `transfer_out` por cada lote.',
  })
  dispatch(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
    return this.service.dispatch(id, req.user?.id || 'system');
  }

  @Post(':id/receive')
  @ApiOperation({
    summary:
      'Recibir traslado: in_transit → completed. Crea/incrementa lote destino (mismo lot_number), genera kardex `transfer_in`. Admite mermas.',
  })
  receive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReceiveTransferDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.receive(id, dto, req.user?.id || 'system');
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancelar traslado. Si estaba in_transit, devuelve stock al origen (kardex `transfer_cancelled`).',
  })
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelTransferDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.cancel(id, dto, req.user?.id || 'system');
  }
}
