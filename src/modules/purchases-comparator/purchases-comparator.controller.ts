import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Param, Query, UseGuards, Controller } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { PurchasesComparatorService } from './purchases-comparator.service';
import { LookupQueryDto, HistoryQueryDto, ProductsQueryDto, ComparisonQueryDto } from './dto';

/**
 * Proxy autenticado al servicio externo product-api-ic (datos iCompras).
 *
 * Por qué proxy y no llamar directo desde el browser:
 *  - La API key del servicio externo nunca queda expuesta al frontend.
 *  - Aplicamos RBAC de SIGAF (`INVENTORY_WRITERS`) — solo gerentes / admins.
 *  - Cache server-side (5 min) protege el rate-limit remoto cuando varios
 *    operadores miran el mismo data al mismo tiempo.
 *
 * Los queries y respuestas son passthrough — preservamos el formato del
 * servicio externo para que el frontend trabaje con los mismos tipos.
 */
@ApiTags('Purchases Comparator')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'purchases/comparator', version: '1' })
export class PurchasesComparatorController {
  constructor(private readonly service: PurchasesComparatorService) {}

  @Get('comparison')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Principios activos paginados con sus laboratorios y precios ordenados (vista principal del comparador).',
  })
  comparison(@Query() query: ComparisonQueryDto) {
    return this.service.proxy('/api/comparison', query);
  }

  @Get('products')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Lista de productos con filtros (búsqueda directa por SKU).' })
  products(@Query() query: ProductsQueryDto) {
    return this.service.proxy('/api/products', query);
  }

  @Get('products/:externalId')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Detalle de un producto con todas sus ofertas por droguería.' })
  productDetail(@Param('externalId') externalId: string) {
    return this.service.proxy(`/api/products/${encodeURIComponent(externalId)}`);
  }

  @Get('products/:externalId/history')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Historial de precios paginado, filtrable por droguería y rango de fechas.' })
  productHistory(@Param('externalId') externalId: string, @Query() query: HistoryQueryDto) {
    return this.service.proxy(`/api/products/${encodeURIComponent(externalId)}/history`, query);
  }

  @Get('active-ingredients/:name/products')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Drilldown: un principio activo con todos sus laboratorios + precios.' })
  ingredientProducts(@Param('name') name: string, @Query() query: ComparisonQueryDto) {
    return this.service.proxy(`/api/active-ingredients/${encodeURIComponent(name)}/products`, query);
  }

  @Get('providers')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Droguerías disponibles (con conteo de ofertas), para filtros.' })
  providers(@Query() query: LookupQueryDto) {
    return this.service.proxy('/api/providers', query);
  }

  @Get('active-ingredients')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Principios activos (paginado + búsqueda), para filtros.' })
  activeIngredients(@Query() query: LookupQueryDto) {
    return this.service.proxy('/api/active-ingredients', query);
  }

  @Get('categories')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Categorías disponibles, para filtros.' })
  categories(@Query() query: LookupQueryDto) {
    return this.service.proxy('/api/categories', query);
  }

  @Get('brands')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Marcas / laboratorios disponibles, para filtros.' })
  brands(@Query() query: LookupQueryDto) {
    return this.service.proxy('/api/brands', query);
  }
}
