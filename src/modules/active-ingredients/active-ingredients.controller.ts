import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { ActiveIngredientsService } from './active-ingredients.service';
import { CreateActiveIngredientDto, UpdateActiveIngredientDto } from './dto';

@ApiTags('Active Ingredients')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'active-ingredients', version: '1' })
export class ActiveIngredientsController {
  constructor(private readonly service: ActiveIngredientsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar principios activos (para sustitución de genéricos)' })
  findAll(@Query('search') search?: string) {
    return this.service.findAll({ search });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear principio activo' })
  create(@Body() dto: CreateActiveIngredientDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateActiveIngredientDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
