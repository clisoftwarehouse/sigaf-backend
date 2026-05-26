import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Query, UseGuards, Controller } from '@nestjs/common';

import { RoleEnum } from '@/modules/roles/roles.enum';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { OverrideRateDto, CreateExchangeRateDto } from './dto';
import { ExchangeRatesService } from './exchange-rates.service';
import { FINANCE_WRITERS } from '@/modules/roles/roles.constants';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

@ApiTags('Exchange Rates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'exchange-rates', version: '1' })
export class ExchangeRatesController {
  constructor(private readonly service: ExchangeRatesService) {}

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar tasas de cambio (filtrar por fuente: BCV, REPOSICION, manual)' })
  findAll(
    @Query('currencyFrom') currencyFrom?: string,
    @Query('currencyTo') currencyTo?: string,
    @Query('source') source?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      currencyFrom,
      currencyTo,
      source,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('latest')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Obtener tasa de cambio más reciente (opcionalmente por fuente)' })
  getLatest(
    @Query('currencyFrom') currencyFrom?: string,
    @Query('currencyTo') currencyTo?: string,
    @Query('source') source?: string,
  ) {
    return this.service.getLatest(currencyFrom, currencyTo, source as never);
  }

  @Post()
  @Roles(RoleEnum.admin, RoleEnum.gerente)
  @ApiOperation({ summary: 'Registrar nueva tasa de cambio' })
  create(@Body() dto: CreateExchangeRateDto) {
    return this.service.create(dto);
  }

  @Post('fetch-bcv')
  @Roles(RoleEnum.admin, RoleEnum.gerente)
  @ApiOperation({ summary: 'Forzar scraping manual de la tasa oficial BCV (USD→VES)' })
  fetchBcv() {
    return this.service.fetchAndSaveBcvRate();
  }

  @Post('override')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({
    summary:
      'Sobreescribir la tasa del día con un valor manual (is_overridden=true). ' +
      'Solo admin — operación financiera con impacto en todo el ERP. Auditada.',
  })
  override(@Body() dto: OverrideRateDto) {
    return this.service.overrideRate(dto);
  }
}
