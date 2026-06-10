import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Query, Param, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { PaymentsService } from '../services/payments.service';
import { AccountsPayableService } from '../services/accounts-payable.service';
import { FINANCE_WRITERS, INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import {
  CancelCxpDto,
  ReversePaymentDto,
  RegisterPaymentDto,
  QueryAccountsPayableDto,
  CreateAccountsPayableDto,
} from '../dto';

@ApiTags('Accounts Payable')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'accounts-payable', version: '1' })
export class AccountsPayableController {
  constructor(
    private readonly cxpService: AccountsPayableService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar CxP con filtros y paginación' })
  list(@Query() query: QueryAccountsPayableDto) {
    return this.cxpService.findAll(query);
  }

  @Get('aging-summary')
  @ApiOperation({ summary: 'Resumen de aging por buckets (current / 30 / 60 / 90 / 90+)' })
  agingSummary(@Query('branchId') branchId?: string) {
    return this.cxpService.getAgingSummary(branchId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una CxP con sus pagos' })
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.cxpService.findOne(id);
  }

  @Post()
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear CxP manualmente (sin recepción origen)' })
  create(@Body() dto: CreateAccountsPayableDto, @Request() req: { user: { id: string } }) {
    return this.cxpService.create(dto, req.user?.id ?? 'system');
  }

  @Post(':id/cancel')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({ summary: 'Cancelar CxP (solo si no tiene pagos aplicados)' })
  cancel(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CancelCxpDto, @Request() req: { user: { id: string } }) {
    return this.cxpService.cancel(id, dto.reason, req.user?.id ?? 'system');
  }

  // ─── Pagos ─────────────────────────────────────────────────────────

  @Get(':id/payments')
  @ApiOperation({ summary: 'Listar pagos de una CxP (incluye revertidos)' })
  listPayments(@Param('id', ParseUUIDPipe) id: string) {
    return this.paymentsService.listForCxp(id);
  }

  @Post(':id/payments')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({ summary: 'Registrar un pago contra una CxP. Actualiza balance + status.' })
  registerPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RegisterPaymentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.paymentsService.registerPayment(id, dto, req.user?.id ?? 'system');
  }

  @Post('payments/:paymentId/reverse')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({
    summary: 'Revertir un pago (soft: queda histórico). Recalcula balance + status del CxP.',
  })
  reversePayment(
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
    @Body() dto: ReversePaymentDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.paymentsService.reversePayment(paymentId, dto.reason, req.user?.id ?? 'system');
  }
}
