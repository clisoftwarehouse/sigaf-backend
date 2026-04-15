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
  @ApiOperation({ summary: 'Listar usos terapéuticos' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll({ search });
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
