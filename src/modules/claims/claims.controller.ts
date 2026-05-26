import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Request, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { ClaimsService } from './claims.service';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { CreateClaimDto, UpdateClaimDto, QueryClaimsDto } from './dto';

@ApiTags('Claims')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'claims', version: '1' })
export class ClaimsController {
  constructor(private readonly claimsService: ClaimsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar reclamos a proveedor con filtros y paginación' })
  findAll(@Query() query: QueryClaimsDto) {
    return this.claimsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener reclamo por ID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.claimsService.findOne(id);
  }

  @Post()
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Crear reclamo a proveedor' })
  create(@Body() dto: CreateClaimDto, @Request() req: { user: { id: string } }) {
    return this.claimsService.create(dto, req.user.id);
  }

  @Put(':id')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({ summary: 'Actualizar reclamo (estado, notas, resolución)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClaimDto,
    @Request() req: { user: { id: string } },
  ) {
    return this.claimsService.update(id, dto, req.user.id);
  }
}
