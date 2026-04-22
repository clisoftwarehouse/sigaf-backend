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
  Request,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { ProductsService } from './products.service';
import {
  AddBarcodeDto,
  QueryProductDto,
  AddIngredientDto,
  CreateProductDto,
  UpdateBarcodeDto,
  UpdateProductDto,
} from './dto';

@ApiTags('Products')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'products', version: '1' })
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar productos con filtros y paginación' })
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get('search')
  @ApiOperation({ summary: 'Buscar productos por nombre, EAN, principio activo o genérico' })
  search(@Query('q') q: string, @Query('type') type?: string) {
    return this.productsService.search(q, type);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto con ingredientes activos, sustitutos y códigos de barra' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear producto con barcodes e ingredientes opcionales' })
  create(@Body() dto: CreateProductDto, @Request() req: { user?: { id: string } }) {
    return this.productsService.create(dto, req.user?.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar producto (registra en audit_log)' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
    @Request() req: { user?: { id: string } },
  ) {
    return this.productsService.update(id, dto, req.user?.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete producto (solo si stock=0)' })
  remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user?: { id: string } }) {
    return this.productsService.remove(id, req.user?.id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Reactivar producto inactivo' })
  restore(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user?: { id: string } }) {
    return this.productsService.restore(id, req.user?.id);
  }

  // ─── INGREDIENTS ───────────────────────────────────────────────────────

  @Post(':id/ingredients')
  @ApiOperation({ summary: 'Agregar principio activo a producto' })
  addIngredient(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddIngredientDto) {
    return this.productsService.addIngredient(id, dto);
  }

  @Delete(':id/ingredients/:ingredientId')
  @ApiOperation({ summary: 'Eliminar principio activo de producto' })
  removeIngredient(@Param('id', ParseUUIDPipe) id: string, @Param('ingredientId', ParseUUIDPipe) ingredientId: string) {
    return this.productsService.removeIngredient(id, ingredientId);
  }

  // ─── SUBSTITUTES ──────────────────────────────────────────────────────

  @Get(':id/substitutes')
  @ApiOperation({ summary: 'Obtener sustitutos (mismo principio activo, con stock>0)' })
  getSubstitutes(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getSubstitutes(id);
  }

  // ─── THERAPEUTIC USES ──────────────────────────────────────────────────

  @Post(':id/therapeutic-uses/:therapeuticUseId')
  @ApiOperation({ summary: 'Asignar uso terapéutico a producto' })
  addTherapeuticUse(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('therapeuticUseId', ParseUUIDPipe) therapeuticUseId: string,
  ) {
    return this.productsService.addTherapeuticUse(id, therapeuticUseId);
  }

  @Delete(':id/therapeutic-uses/:therapeuticUseId')
  @ApiOperation({ summary: 'Quitar uso terapéutico de producto' })
  removeTherapeuticUse(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('therapeuticUseId', ParseUUIDPipe) therapeuticUseId: string,
  ) {
    return this.productsService.removeTherapeuticUse(id, therapeuticUseId);
  }

  // ─── PURCHASE HISTORY ──────────────────────────────────────────────────

  @Get(':id/purchase-history')
  @ApiOperation({ summary: 'Historial de compras del producto (proveedor, fecha, lote, costo)' })
  getPurchaseHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.productsService.getPurchaseHistory(id, { from, to, supplierId });
  }

  // ─── BARCODES ──────────────────────────────────────────────────────────

  @Get(':id/barcodes')
  @ApiOperation({ summary: 'Listar códigos de barra del producto' })
  getBarcodes(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.getProductBarcodes(id);
  }

  @Post(':id/barcodes')
  @ApiOperation({ summary: 'Agregar código de barras a producto' })
  addBarcode(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AddBarcodeDto) {
    return this.productsService.addBarcode(id, dto);
  }

  @Delete(':id/barcodes/:barcodeId')
  @ApiOperation({ summary: 'Eliminar código de barras de producto' })
  removeBarcode(@Param('id', ParseUUIDPipe) id: string, @Param('barcodeId', ParseUUIDPipe) barcodeId: string) {
    return this.productsService.removeBarcode(id, barcodeId);
  }

  @Put(':id/barcodes/:barcodeId')
  @ApiOperation({ summary: 'Actualizar código de barras existente (valor, tipo, isPrimary)' })
  updateBarcode(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('barcodeId', ParseUUIDPipe) barcodeId: string,
    @Body() dto: UpdateBarcodeDto,
  ) {
    return this.productsService.updateBarcode(id, barcodeId, dto);
  }
}
