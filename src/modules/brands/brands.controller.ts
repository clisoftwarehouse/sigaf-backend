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

import { BrandsService } from './brands.service';
import { CreateBrandDto, UpdateBrandDto } from './dto';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { CATALOG_WRITERS } from '@/modules/roles/roles.constants';

@ApiTags('Brands')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'brands', version: '1' })
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar marcas/laboratorios' })
  findAll(
    @Query('search') search?: string,
    @Query('isLaboratory') isLaboratory?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.brandsService.findAll({
      search,
      isLaboratory: isLaboratory === 'true' ? true : isLaboratory === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.findOne(id);
  }

  @Post()
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Crear marca/laboratorio' })
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @Put(':id')
  @Roles(...CATALOG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...CATALOG_WRITERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.remove(id);
  }

  @Patch(':id/restore')
  @Roles(...CATALOG_WRITERS)
  @ApiOperation({ summary: 'Reactivar marca inactiva' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.brandsService.restore(id);
  }
}
