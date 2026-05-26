import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { LocationsService } from './locations.service';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { ORG_WRITERS } from '@/modules/roles/roles.constants';
import { QueryLocationDto, CreateLocationDto, UpdateLocationDto } from './dto';

@ApiTags('Locations')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'locations', version: '1' })
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar ubicaciones de almacén' })
  findAll(@Query() query: QueryLocationDto) {
    return this.locationsService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.findOne(id);
  }

  @Post()
  @Roles(...ORG_WRITERS)
  @ApiOperation({ summary: 'Crear ubicación de almacén' })
  create(@Body() dto: CreateLocationDto) {
    return this.locationsService.create(dto);
  }

  @Put(':id')
  @Roles(...ORG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateLocationDto) {
    return this.locationsService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ORG_WRITERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.locationsService.remove(id);
  }
}
