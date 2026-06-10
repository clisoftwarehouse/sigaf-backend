import { AuthGuard } from '@nestjs/passport';
import { Get, Query, UseGuards, Controller } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';

import { LibroQueryDto } from './dto';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { LibroVentasService } from './libro-ventas.service';
import { LibroComprasService } from './libro-compras.service';
import { FINANCE_WRITERS } from '@/modules/roles/roles.constants';

@ApiTags('Libros IVA (SENIAT)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'libros-iva', version: '1' })
export class LibrosIvaController {
  constructor(
    private readonly ventasService: LibroVentasService,
    private readonly comprasService: LibroComprasService,
  ) {}

  @Get('ventas')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({
    summary: 'Libro de Ventas del IVA para un período mensual. Estructura conforme Providencia 0071 + Reglamento LIVA.',
  })
  libroVentas(@Query() query: LibroQueryDto) {
    return this.ventasService.generate(query.year, query.month, query.branchId);
  }

  @Get('compras')
  @Roles(...FINANCE_WRITERS)
  @ApiOperation({
    summary: 'Libro de Compras del IVA para un período mensual. Valida Art. 57 LIVA (crédito fiscal).',
  })
  libroCompras(@Query() query: LibroQueryDto) {
    return this.comprasService.generate(query.year, query.month, query.branchId);
  }
}
