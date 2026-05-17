import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Req, Body, Post, Param, Query, HttpCode, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';
import { OpenCashSessionDto, CloseCashSessionDto, QueryCashSessionDto, CreateManualMovementDto } from './dto';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'cash-sessions', version: '1' })
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Post('open')
  @ApiOperation({ summary: 'Abrir sesión de caja para un terminal' })
  open(@Body() dto: OpenCashSessionDto, @Req() req: RequestWithUser) {
    return this.cashSessionsService.open(dto, req.user!.id!);
  }

  @Post(':id/close')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cerrar sesión y registrar arqueo' })
  close(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseCashSessionDto, @Req() req: RequestWithUser) {
    return this.cashSessionsService.close(id, dto, req.user!.id!);
  }

  @Get('current')
  @ApiOperation({ summary: 'Devuelve la sesión abierta del terminal o null' })
  findCurrent(@Query('terminalId', ParseUUIDPipe) terminalId: string) {
    return this.cashSessionsService.findCurrentByTerminal(terminalId);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sesiones (filtros + paginado)' })
  findAll(@Query() query: QueryCashSessionDto) {
    return this.cashSessionsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de sesión con todos sus movements' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.findOne(id);
  }

  @Post(':id/movements')
  @ApiOperation({ summary: 'Agregar movimiento manual (payout/deposit/adjustment)' })
  addMovement(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateManualMovementDto,
    @Req() req: RequestWithUser,
  ) {
    return this.cashSessionsService.addManualMovement(id, dto, req.user!.id!);
  }

  @Get(':id/x-report')
  @ApiOperation({ summary: 'Corte X (parcial) de la sesión' })
  xReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.getXReport(id);
  }

  @Get(':id/z-report')
  @ApiOperation({ summary: 'Reporte Z (post-cierre, inmutable)' })
  zReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.getZReport(id);
  }
}
