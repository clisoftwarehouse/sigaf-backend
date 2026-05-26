import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { CATALOG_WRITERS } from '@/modules/roles/roles.constants';
import { TherapeuticUsesService } from './therapeutic-uses.service';
import { CreateTherapeuticUseDto, UpdateTherapeuticUseDto } from './dto';

@ApiTags('Therapeutic Uses')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'therapeutic-uses', version: '1' })
export class TherapeuticUsesController {
  constructor(private readonly service: TherapeuticUsesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar acciones terapéuticas (filtrable por nombre o prefijo ATC)' })
  findAll(@Query('search') search?: string, @Query('atcCode') atcCode?: string) {
    return this.service.findAll({ search, atcCode });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crear acción terapéutica' })
  create(@Body() dto: CreateTherapeuticUseDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  @Roles(...CATALOG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTherapeuticUseDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Roles(...CATALOG_WRITERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
