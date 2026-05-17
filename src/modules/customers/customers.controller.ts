import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Req,
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

import { CustomersService } from './customers.service';
import { QueryCustomerDto, CreateCustomerDto, UpdateCustomerDto } from './dto';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar clientes (paginado)' })
  findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

  @Get('by-document/:type/:number')
  @ApiOperation({ summary: 'Buscar cliente por tipo + número de documento' })
  findByDocument(@Param('type') type: string, @Param('number') number: string) {
    return this.customersService.findByDocument(type, number);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener cliente por id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear cliente' })
  create(@Body() dto: CreateCustomerDto, @Req() req: RequestWithUser) {
    return this.customersService.create(dto, req.user?.id ?? null);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar cliente (soft-delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Reactivar cliente inactivo' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(id);
  }
}
