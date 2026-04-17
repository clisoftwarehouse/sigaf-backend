import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Query, UseGuards, Controller } from '@nestjs/common';

import { OverrideRateDto, CreateExchangeRateDto } from './dto';
import { ExchangeRatesService } from './exchange-rates.service';

@ApiTags('Exchange Rates')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'exchange-rates', version: '1' })
export class ExchangeRatesController {
  constructor(private readonly service: ExchangeRatesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar tasas de cambio (BCV)' })
  findAll(
    @Query('currencyFrom') currencyFrom?: string,
    @Query('currencyTo') currencyTo?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.findAll({
      currencyFrom,
      currencyTo,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Get('latest')
  @ApiOperation({ summary: 'Obtener tasa de cambio más reciente' })
  getLatest(@Query('currencyFrom') currencyFrom?: string, @Query('currencyTo') currencyTo?: string) {
    return this.service.getLatest(currencyFrom, currencyTo);
  }

  @Post()
  @ApiOperation({ summary: 'Registrar nueva tasa de cambio' })
  create(@Body() dto: CreateExchangeRateDto) {
    return this.service.create(dto);
  }

  @Post('fetch-bcv')
  @ApiOperation({ summary: 'Forzar scraping manual de la tasa oficial BCV (USD→VES)' })
  fetchBcv() {
    return this.service.fetchAndSaveBcvRate();
  }

  @Post('override')
  @ApiOperation({ summary: 'Sobreescribir la tasa del día con un valor manual (is_overridden=true)' })
  override(@Body() dto: OverrideRateDto) {
    return this.service.overrideRate(dto);
  }
}
