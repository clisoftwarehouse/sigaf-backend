import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Body,
  Post,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { CategoriesService } from './categories.service';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CATALOG_WRITERS } from '@/modules/roles/roles.constants';

@ApiTags('Categories')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'Obtener todas las categorías en árbol jerárquico' })
  findAll(@Query('isActive') isActive?: string) {
    const filter = isActive === undefined ? undefined : { isActive: isActive === 'true' };
    return this.categoriesService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.findOne(id);
  }

  @Post()
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crear nueva categoría' })
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Put(':id')
  @Roles(...CATALOG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Get(':id/active-descendants-count')
  @ApiOperation({
    summary:
      'Cuenta subcategorías activas (recursivo). Útil para preguntar al usuario si quiere cascada antes de inactivar.',
  })
  async getActiveDescendantsCount(@Param('id', ParseUUIDPipe) id: string) {
    const count = await this.categoriesService.countActiveDescendants(id);
    return { count };
  }

  @Delete(':id')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({
    summary: 'Inactiva la categoría. Con `?cascade=true` inactiva también las subcategorías descendientes.',
  })
  remove(@Param('id', ParseUUIDPipe) id: string, @Query('cascade') cascade?: string) {
    return this.categoriesService.remove(id, { cascade: cascade === 'true' });
  }

  @Patch(':id/restore')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Reactivar categoría inactiva' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.categoriesService.restore(id);
  }
}
