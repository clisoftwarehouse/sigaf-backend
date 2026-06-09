import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Query, Param, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { ClassificationsService } from '../services/classifications.service';

@ApiTags('Purchases Intelligence — Classifications')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'purchases-intelligence', version: '1' })
export class ClassificationsController {
  constructor(private readonly service: ClassificationsService) {}

  @Post('recalculate')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary:
      'Recalcula el ABCD de TODOS los productos activos de una sucursal — clasifica usando 5 dim (rotación 35 / pareto 25 / margen 20 / inv 15 / venc 5). Sobrescribe el snapshot vigente.',
  })
  recalculate(@Body() body: { branchId: string }) {
    return this.service.recalculate(body.branchId);
  }

  @Get('classifications')
  @ApiOperation({
    summary: 'Portafolio ABCD vigente de la sucursal, filtrable por categoría A/B/C/D o por isPareto.',
  })
  list(
    @Query('branchId', ParseUUIDPipe) branchId: string,
    @Query('abcd') abcd?: 'A' | 'B' | 'C' | 'D',
    @Query('isPareto') isPareto?: string,
  ) {
    return this.service.findByBranch(branchId, {
      abcd,
      isPareto: isPareto != null ? isPareto === 'true' : undefined,
    });
  }

  @Get('classifications/:productId')
  @ApiOperation({ summary: 'Detalle de clasificación de un producto en una sucursal.' })
  detail(@Param('productId', ParseUUIDPipe) productId: string, @Query('branchId', ParseUUIDPipe) branchId: string) {
    return this.service.findOne(productId, branchId);
  }
}
