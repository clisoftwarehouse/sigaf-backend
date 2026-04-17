import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { ActiveIngredientsService } from './active-ingredients.service';
import { CreateActiveIngredientDto, UpdateActiveIngredientDto } from './dto';

@ApiTags('Active Ingredients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'active-ingredients', version: '1' })
export class ActiveIngredientsController {
  constructor(private readonly service: ActiveIngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar principios activos (filtrable por nombre/INN o prefijo ATC)' })
  findAll(@Query('search') search?: string, @Query('atcCode') atcCode?: string) {
    return this.service.findAll({ search, atcCode });
  }

  @Get('vademecum-lookup')
  @ApiOperation({
    summary: 'Buscar candidatos en vademecum.es con su código ATC (best-effort; no persiste)',
  })
  vademecumLookup(@Query('q') q: string, @Query('limit') limit?: string) {
    const parsed = limit ? parseInt(limit, 10) : 10;
    return this.service.lookupVademecum(q ?? '', Number.isFinite(parsed) ? parsed : 10);
  }

  @Get('vademecum-debug')
  @ApiOperation({ summary: '[DEBUG] Devuelve HTML crudo de vademecum.es para ajustar el parser' })
  vademecumDebug(@Query('q') q: string) {
    return this.service.debugVademecum(q ?? '');
  }

  @Get('vademecum-details')
  @ApiOperation({
    summary: 'Detalles enriquecidos del candidato (jerarquía ATC + grupo terapéutico derivado) sin persistir',
  })
  vademecumDetails(@Query('q') q: string, @Query('index') index?: string) {
    const parsed = index ? parseInt(index, 10) : 0;
    return this.service.fetchVademecumDetails(q ?? '', Number.isFinite(parsed) ? parsed : 0);
  }

  @Post('vademecum-import')
  @ApiOperation({
    summary:
      'Importar (upsert) un principio activo desde vademecum.es con su jerarquía ATC y grupo terapéutico derivado',
  })
  vademecumImport(@Body() body: { q: string; index?: number }) {
    return this.service.importFromVademecum(body.q, body.index ?? 0);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear principio activo' })
  create(@Body() dto: CreateActiveIngredientDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActiveIngredientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
