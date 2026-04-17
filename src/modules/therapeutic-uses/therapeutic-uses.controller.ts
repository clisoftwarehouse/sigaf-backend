import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { TherapeuticUsesService } from './therapeutic-uses.service';
import { CreateTherapeuticUseDto, UpdateTherapeuticUseDto } from './dto';

@ApiTags('Therapeutic Uses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'therapeutic-uses', version: '1' })
export class TherapeuticUsesController {
  constructor(private readonly service: TherapeuticUsesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar usos terapéuticos (filtrable por nombre o prefijo ATC)' })
  findAll(@Query('search') search?: string, @Query('atcCode') atcCode?: string) {
    return this.service.findAll({ search, atcCode });
  }

  @Get('vademecum-lookup')
  @ApiOperation({
    summary: 'Obtener jerarquía ATC (niveles 1-4) de un principio desde vademecum.es',
  })
  vademecumLookup(@Query('q') q: string) {
    return this.service.lookupVademecum(q ?? '');
  }

  @Post('vademecum-import')
  @ApiOperation({
    summary: 'Importar (upsert) la jerarquía ATC completa desde vademecum.es como usos terapéuticos',
  })
  vademecumImport(@Body() body: { q: string }) {
    return this.service.importVademecumHierarchy(body.q);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear uso terapéutico' })
  create(@Body() dto: CreateTherapeuticUseDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTherapeuticUseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
