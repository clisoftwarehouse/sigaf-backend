import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Req,
  Body,
  Post,
  Param,
  Query,
  Delete,
  Headers,
  HttpCode,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { TerminalsService } from './terminals.service';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { ORG_WRITERS } from '@/modules/roles/roles.constants';
import { TerminalPairingService } from './terminal-pairing.service';
import { PairTerminalDto, CreateTerminalDto, UpdateTerminalDto } from './dto';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Terminals')
@Controller({ path: 'terminals', version: '1' })
export class TerminalsController {
  constructor(
    private readonly service: TerminalsService,
    private readonly pairingService: TerminalPairingService,
  ) {}

  // ─── Pareja: pair (público) y me (usa apiKey en header) ─────────────
  // Estos endpoints NO usan JWT del cajero; el primero porque aún no hay
  // credencial, y el segundo porque autentica con apiKey del equipo.

  @Post('pair')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Emparejar este equipo con un terminal usando un código emitido por admin',
  })
  pair(@Body() dto: PairTerminalDto) {
    return this.pairingService.pair(dto.code);
  }

  @Get('me')
  @ApiOperation({ summary: 'Info del terminal asociado a la apiKey enviada' })
  async me(@Headers('x-terminal-api-key') apiKey?: string) {
    const validated = await this.pairingService.validateApiKey(apiKey);
    return this.service.findOne(validated.terminalId);
  }

  // ─── Resto de endpoints (admin con JWT) ─────────────────────────────

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar terminales POS por sucursal' })
  findAll(@Query('branchId') branchId?: string) {
    return this.service.findAll({ branchId });
  }

  @Get(':id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiBearerAuth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear terminal POS (con config impresora fiscal)' })
  create(@Body() dto: CreateTerminalDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTerminalDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  // ─── Pairing tokens y apiKeys (admin) ───────────────────────────────

  @Post(':id/pairing-codes')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generar código one-shot para emparejar un PC' })
  issuePairingCode(@Param('id', ParseUUIDPipe) id: string, @Req() req: RequestWithUser) {
    return this.pairingService.issuePairingCode(id, req.user!.id!);
  }

  @Get(':id/api-keys')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Listar apiKeys del terminal (sin valor crudo, sólo metadata)' })
  listApiKeys(@Param('id', ParseUUIDPipe) id: string) {
    return this.pairingService.listApiKeysByTerminal(id);
  }

  @Post(':id/api-keys/:keyId/revoke')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...ORG_WRITERS)
  @ApiBearerAuth()
  @HttpCode(204)
  @ApiOperation({ summary: 'Revocar apiKey de un terminal (fuerza re-pairing)' })
  async revokeApiKey(@Param('keyId', ParseUUIDPipe) keyId: string, @Req() req: RequestWithUser): Promise<void> {
    await this.pairingService.revokeApiKey(keyId, req.user!.id!);
  }
}
