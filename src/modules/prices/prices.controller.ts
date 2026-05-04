import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { PricesService } from './prices.service';
import { CreatePriceDto, UpdatePriceDto, QueryPricesDto, QueryCurrentPriceDto } from './dto';

@ApiTags('Prices')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'prices', version: '1' })
export class PricesController {
  constructor(private readonly service: PricesService) {}

  @Post()
  @ApiOperation({
    summary:
      'Crear precio (USD). Cierra automáticamente el precio vigente anterior del mismo scope (producto + sucursal|null).',
  })
  create(@Body() dto: CreatePriceDto, @Request() req: { user: { id: string } }) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  @ApiOperation({ summary: 'Listar precios (por defecto solo vigentes — pasar includeHistory=true para histórico)' })
  findAll(@Query() query: QueryPricesDto) {
    return this.service.findAll(query);
  }

  @Get('current')
  @ApiOperation({
    summary:
      'Resolver precio vigente: override por sucursal → global → fallback al sale_price del lote. Retorna source y priceUsd.',
  })
  getCurrent(@Query() query: QueryCurrentPriceDto) {
    return this.service.getCurrentPrice(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener precio por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({
    summary:
      'Corrección sobre un precio (typo/notas). No cambia vigencia ni scope. Si se modifica priceUsd se exige justification y queda registrado en audit_log.',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.service.update(id, dto, req.user?.id || 'system');
  }

  @Post(':id/expire')
  @ApiOperation({ summary: 'Expirar manualmente un precio vigente (effective_to = now)' })
  expire(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.expire(id);
  }
}
