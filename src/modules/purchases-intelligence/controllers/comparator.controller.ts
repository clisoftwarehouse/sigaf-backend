import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { Min, IsNumber, IsOptional } from 'class-validator';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Query, Param, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { ComparatorService } from '../services/comparator.service';

class CompareQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  quantity?: number;
}

/**
 * Comparador INTERNO de droguerías para un producto del catálogo SIGAF.
 *
 * No confundir con el Comparador EXTERNO (módulo `purchases-comparator`)
 * que lee precios de iCompras360. Este compara únicamente nuestras
 * droguerías registradas y sus condiciones comerciales configuradas.
 */
@ApiTags('Purchases Intelligence — Comparator')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'purchases-intelligence/comparator', version: '1' })
export class ComparatorController {
  constructor(private readonly service: ComparatorService) {}

  @Get(':productId')
  @ApiOperation({
    summary:
      'Compara las droguerías que ofrecen este producto, rankeadas por score 0-100 (5 dim: costo, disponibilidad, vencimiento, crédito, entrega).',
  })
  compare(@Param('productId', ParseUUIDPipe) productId: string, @Query() query: CompareQueryDto) {
    return this.service.compareForProduct(productId, query.quantity ?? 1);
  }
}
