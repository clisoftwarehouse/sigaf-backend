import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Param, Query, HttpCode, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { CashSessionsService } from './cash-sessions.service';
import { TerminalApiKeyGuard } from '@/common/guards/terminal-api-key.guard';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';
import { OpenCashSessionDto, CloseCashSessionDto, QueryCashSessionDto, CreateManualMovementDto } from './dto';

@ApiTags('Cash Sessions')
@ApiBearerAuth()
@Controller({ path: 'cash-sessions', version: '1' })
// NOTA: igual que SalesController, los endpoints transaccionales (open/close/
// movements) usan SOLO TerminalApiKeyGuard porque el cajero puede haber
// logueado offline sin JWT. El usuario que ejecuta la operación viene como
// `cashierUserId` en el DTO. Los GET de consulta sí requieren JWT.
export class CashSessionsController {
  constructor(private readonly cashSessionsService: CashSessionsService) {}

  @Post('open')
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({ summary: 'Abrir sesión de caja para un terminal' })
  open(@Body() dto: OpenCashSessionDto) {
    return this.cashSessionsService.open(dto, dto.cashierUserId ?? null);
  }

  @Post(':id/close')
  @HttpCode(200)
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({ summary: 'Cerrar sesión y registrar arqueo' })
  close(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CloseCashSessionDto) {
    return this.cashSessionsService.close(id, dto, dto.cashierUserId ?? null);
  }

  @Get('current')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Devuelve la sesión abierta del terminal o null' })
  findCurrent(@Query('terminalId', ParseUUIDPipe) terminalId: string) {
    return this.cashSessionsService.findCurrentByTerminal(terminalId);
  }

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar sesiones (filtros + paginado)' })
  findAll(@Query() query: QueryCashSessionDto) {
    return this.cashSessionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Detalle de sesión con todos sus movements' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.findOne(id);
  }

  @Post(':id/movements')
  @UseGuards(TerminalApiKeyGuard)
  @ApiOperation({ summary: 'Agregar movimiento manual (payout/deposit/adjustment)' })
  addMovement(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateManualMovementDto) {
    return this.cashSessionsService.addManualMovement(id, dto, dto.cashierUserId ?? null);
  }

  @Get(':id/x-report')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Corte X (parcial) de la sesión' })
  xReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.getXReport(id);
  }

  @Get(':id/z-report')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Reporte Z (post-cierre, inmutable)' })
  zReport(@Param('id', ParseUUIDPipe) id: string) {
    return this.cashSessionsService.getZReport(id);
  }
}
