import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Param, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { CATALOG_WRITERS } from '@/modules/roles/roles.constants';
import { CommercialTaxonomiesService } from './commercial-taxonomies.service';
import { CreateCommercialTaxonomyDto } from './dto/create-commercial-taxonomy.dto';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

@ApiTags('Commercial Taxonomies')
@ApiBearerAuth()
@Controller({ version: '1' })
export class CommercialTaxonomiesController {
  constructor(private readonly service: CommercialTaxonomiesService) {}

  // ─── Líneas comerciales ────────────────────────────────────────────────

  @Get('commercial-lines')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar líneas comerciales activas' })
  findAllLines() {
    return this.service.findAllLines();
  }

  @Get('commercial-lines/:id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Obtener una línea comercial' })
  findOneLine(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneLine(id);
  }

  @Post('commercial-lines')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crear nueva línea comercial' })
  createLine(@Body() dto: CreateCommercialTaxonomyDto) {
    return this.service.createLine(dto);
  }

  // ─── Variantes comerciales ────────────────────────────────────────────

  @Get('commercial-variants')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar variantes comerciales activas' })
  findAllVariants() {
    return this.service.findAllVariants();
  }

  @Get('commercial-variants/:id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Obtener una variante comercial' })
  findOneVariant(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOneVariant(id);
  }

  @Post('commercial-variants')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crear nueva variante comercial' })
  createVariant(@Body() dto: CreateCommercialTaxonomyDto) {
    return this.service.createVariant(dto);
  }
}
