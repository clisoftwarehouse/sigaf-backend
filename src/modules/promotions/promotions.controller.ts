import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Body,
  Post,
  Param,
  Query,
  Delete,
  Request,
  HttpCode,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { PromotionsService } from './promotions.service';
import {
  AddScopeDto,
  CreatePromotionDto,
  UpdatePromotionDto,
  QueryPromotionsDto,
  QueryApplicablePromotionsDto,
} from './dto';

@ApiTags('Promotions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'promotions', version: '1' })
export class PromotionsController {
  constructor(private readonly service: PromotionsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear promoción (con scopes opcionales). Valores siempre en USD.' })
  create(@Body() dto: CreatePromotionDto, @Request() req: { user: { id: string } }) {
    return this.service.create(dto, req.user?.id || 'system');
  }

  @Get()
  @ApiOperation({ summary: 'Listar promociones. Por defecto solo vigentes y activas.' })
  findAll(@Query() query: QueryPromotionsDto) {
    return this.service.findAll(query);
  }

  @Get('applicable')
  @ApiOperation({
    summary:
      'Promociones aplicables a un producto (opcional: sucursal, cantidad, priceUsd). Si se pasa priceUsd y quantity, cada promo viene con discountUsd y finalTotalUsd calculados.',
  })
  getApplicable(@Query() query: QueryApplicablePromotionsDto) {
    return this.service.getApplicable(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de promoción (incluye scopes)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar campos (type y scopes no se editan aquí)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePromotionDto) {
    return this.service.update(id, dto);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Reactivar promoción desactivada' })
  activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setActive(id, true);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Desactivar promoción (sin expirar — puede reactivarse)' })
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.setActive(id, false);
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar promoción definitivamente (scopes cascade)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @Post(':id/scopes')
  @ApiOperation({ summary: 'Agregar scope (producto / categoría / sucursal) a la promoción' })
  addScope(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddScopeDto) {
    return this.service.addScope(id, dto);
  }

  @Delete(':id/scopes/:scopeId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Quitar scope de la promoción' })
  removeScope(@Param('id', ParseUUIDPipe) id: string, @Param('scopeId', ParseUUIDPipe) scopeId: string) {
    return this.service.removeScope(id, scopeId);
  }

  @Post(':id/record-use')
  @ApiOperation({
    summary:
      'Registrar uso (incrementa usesCount atómicamente). El POS lo invoca al cerrar una venta que aplicó esta promo.',
  })
  recordUse(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.recordUse(id);
  }
}
