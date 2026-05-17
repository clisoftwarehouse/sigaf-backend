import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiHeader, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Req,
  Body,
  Post,
  Param,
  Query,
  Headers,
  HttpCode,
  UseGuards,
  Controller,
  ParseIntPipe,
  ParseUUIDPipe,
  UseInterceptors,
} from '@nestjs/common';

import { SalesService } from './sales.service';
import { Idempotent } from '@/modules/idempotency/idempotent.decorator';
import { IdempotencyInterceptor } from '@/modules/idempotency/idempotency.interceptor';
import {
  QueryPaymentsDto,
  VoidSaleTicketDto,
  QuerySaleTicketDto,
  CreateSaleTicketDto,
  CreateSaleReturnDto,
} from './dto';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Sales')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@UseInterceptors(IdempotencyInterceptor)
@Controller({ path: 'sales', version: '1' })
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('tickets')
  @Idempotent()
  @ApiOperation({ summary: 'Crear ticket de venta (transaccional, idempotente)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID generado por el cliente. Obligatorio.',
    required: true,
  })
  create(
    @Body() dto: CreateSaleTicketDto,
    @Req() req: RequestWithUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.salesService.create(dto, req.user!.id!, idempotencyKey ?? null);
  }

  @Post('tickets/:id/void')
  @HttpCode(200)
  @ApiOperation({ summary: 'Anular ticket (revierte stock + asienta ajustes)' })
  void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidSaleTicketDto, @Req() req: RequestWithUser) {
    return this.salesService.void(id, dto, req.user!.id!);
  }

  @Post('returns')
  @Idempotent()
  @ApiOperation({
    summary: 'Devolución parcial o total sobre un ticket (nota de crédito)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID generado por el cliente. Obligatorio.',
    required: true,
  })
  createReturn(
    @Body() dto: CreateSaleReturnDto,
    @Req() req: RequestWithUser,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.salesService.createReturn(dto, req.user!.id!, idempotencyKey ?? null);
  }

  @Get('tickets/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Get('tickets/by-number/:terminalId/:ticketNumber')
  @ApiOperation({ summary: 'Buscar por terminal + ticket_number interno' })
  findByNumber(
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Param('ticketNumber', ParseIntPipe) ticketNumber: number,
  ) {
    return this.salesService.findByTicketNumber(terminalId, ticketNumber);
  }

  @Get('tickets')
  findAll(@Query() query: QuerySaleTicketDto) {
    return this.salesService.findAll(query);
  }

  @Get('payments')
  @ApiOperation({
    summary: 'Reporte de pagos por método (paginado + resumen agregado) para conciliación bancaria',
  })
  findPayments(@Query() query: QueryPaymentsDto) {
    return this.salesService.findPayments(query);
  }
}
