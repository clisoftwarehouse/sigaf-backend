import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { SuppliersService } from './suppliers.service';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierProductDto,
  UpdateSupplierProductDto,
  CreateSupplierContactDto,
  UpdateSupplierContactDto,
} from './dto';

@ApiTags('Suppliers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'suppliers', version: '1' })
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  @ApiOperation({ summary: 'Listar proveedores/droguerías' })
  findAll(
    @Query('search') search?: string,
    @Query('isDrugstore') isDrugstore?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.suppliersService.findAll({
      search,
      isDrugstore: isDrugstore === 'true' ? true : isDrugstore === 'false' ? false : undefined,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear proveedor' })
  create(@Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSupplierDto) {
    return this.suppliersService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.remove(id);
  }

  @Get(':id/products')
  @ApiOperation({ summary: 'Listar productos asociados al proveedor' })
  findSupplierProducts(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findSupplierProducts(id);
  }

  @Post(':id/products')
  @ApiOperation({ summary: 'Asociar producto a proveedor con costo y SKU' })
  createSupplierProduct(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSupplierProductDto) {
    return this.suppliersService.createSupplierProduct(id, dto);
  }

  @Put(':id/products/:supplierProductId')
  @ApiOperation({ summary: 'Actualizar costo/SKU; al cambiar costo se preserva en lastCostUsd' })
  updateSupplierProduct(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('supplierProductId', ParseUUIDPipe) supplierProductId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.suppliersService.updateSupplierProduct(id, supplierProductId, dto);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: 'Listar personas de contacto del proveedor' })
  findSupplierContacts(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliersService.findSupplierContacts(id);
  }

  @Post(':id/contacts')
  @ApiOperation({ summary: 'Agregar persona de contacto al proveedor' })
  createSupplierContact(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateSupplierContactDto) {
    return this.suppliersService.createSupplierContact(id, dto);
  }

  @Put(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Actualizar contacto del proveedor' })
  updateSupplierContact(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
    @Body() dto: UpdateSupplierContactDto,
  ) {
    return this.suppliersService.updateSupplierContact(id, contactId, dto);
  }

  @Delete(':id/contacts/:contactId')
  @ApiOperation({ summary: 'Eliminar contacto del proveedor' })
  removeSupplierContact(@Param('id', ParseUUIDPipe) id: string, @Param('contactId', ParseUUIDPipe) contactId: string) {
    return this.suppliersService.removeSupplierContact(id, contactId);
  }
}
