import { ApiTags, ApiHeader, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
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
import { TerminalApiKeyGuard } from '@/common/guards/terminal-api-key.guard';
import { IdempotencyInterceptor } from '@/modules/idempotency/idempotency.interceptor';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';
import {
  QueryPaymentsDto,
  VoidSaleTicketDto,
  QuerySaleTicketDto,
  CreateSaleTicketDto,
  CreateSaleReturnDto,
} from './dto';

@ApiTags('Sales')
@ApiBearerAuth()
@UseInterceptors(IdempotencyInterceptor)
@Controller({ path: 'sales', version: '1' })
// NOTA: NO hay `@UseGuards(AuthGuard('jwt'))` a nivel de clase. Los endpoints
// transaccionales (POST tickets/returns/void) usan SOLO `TerminalApiKeyGuard`
// porque deben funcionar offline-first: cuando el cajero loguea sin red, el
// JWT del backend no existe pero la apiKey del terminal sí (cacheada por
// pairing). El cajero se identifica vía `cashierUserId` en el DTO.
// Los endpoints de consulta (GET) sí requieren JWT — son admin/reportes online.
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post('tickets')
  @Idempotent()
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({ summary: 'Crear ticket de venta (transaccional, idempotente)' })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID generado por el cliente. Obligatorio.',
    required: true,
  })
  @ApiHeader({
    name: 'X-Terminal-Api-Key',
    description: 'apiKey del terminal pairing-ed. Obligatoria.',
    required: true,
  })
  create(@Body() dto: CreateSaleTicketDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.salesService.create(dto, dto.cashierUserId ?? null, idempotencyKey ?? null);
  }

  @Post('tickets/:id/void')
  @HttpCode(200)
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({ summary: 'Anular ticket (revierte stock + asienta ajustes)' })
  void(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VoidSaleTicketDto) {
    return this.salesService.void(id, dto, dto.cashierUserId ?? null);
  }

  @Post('returns')
  @Idempotent()
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({
    summary: 'Devolución parcial o total sobre un ticket (nota de crédito)',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    description: 'UUID generado por el cliente. Obligatorio.',
    required: true,
  })
  @ApiHeader({
    name: 'X-Terminal-Api-Key',
    description: 'apiKey del terminal pairing-ed. Obligatoria.',
    required: true,
  })
  createReturn(@Body() dto: CreateSaleReturnDto, @Headers('idempotency-key') idempotencyKey?: string) {
    return this.salesService.createReturn(dto, dto.cashierUserId ?? null, idempotencyKey ?? null);
  }

  @Get('tickets/:id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Get('tickets/by-number/:terminalId/:ticketNumber')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Buscar por terminal + ticket_number interno' })
  findByNumber(
    @Param('terminalId', ParseUUIDPipe) terminalId: string,
    @Param('ticketNumber', ParseIntPipe) ticketNumber: number,
  ) {
    return this.salesService.findByTicketNumber(terminalId, ticketNumber);
  }

  @Get('tickets/by-provisional/:provisionalNumber')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary:
      'Lookup global por número provisional (`T1-001`). Útil cuando un cliente con ticket cerrado offline en una terminal vuelve a devolver en otra.',
  })
  findByProvisional(@Param('provisionalNumber') provisionalNumber: string) {
    return this.salesService.findByProvisionalNumber(provisionalNumber);
  }

  @Get('tickets/by-branch-number/:branchId/:ticketNumber')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary:
      'Lookup por (branchId, ticket_number) sin filtrar por terminal. Para devoluciones cuando el cajero solo conoce el # del ticket y la caja original puede haber sido desactivada.',
  })
  findByBranchAndNumber(
    @Param('branchId', ParseUUIDPipe) branchId: string,
    @Param('ticketNumber', ParseIntPipe) ticketNumber: number,
  ) {
    return this.salesService.findByBranchAndNumber(branchId, ticketNumber);
  }

  @Get('tickets')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  findAll(@Query() query: QuerySaleTicketDto) {
    return this.salesService.findAll(query);
  }

  @Get('payments')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary: 'Reporte de pagos por método (paginado + resumen agregado) para conciliación bancaria',
  })
  findPayments(@Query() query: QueryPaymentsDto) {
    return this.salesService.findPayments(query);
  }
}
