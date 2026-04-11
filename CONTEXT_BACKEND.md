# SIGEF Backend — Contexto para Claude Code

## Qué es SIGEF

ERP/POS offline-first para farmacias en Venezuela. Este contexto cubre el **backend cloud** (API REST). El POS local (Electron) se construye después.

## Stack

- **Framework:** NestJS 10
- **ORM:** TypeORM
- **Base de datos:** PostgreSQL 16 (hosteado en NeonDB — ya desplegado con el schema completo)
- **Cache:** Redis 7
- **Auth:** @nestjs/jwt + @nestjs/passport + bcrypt
- **Validación:** class-validator + class-transformer
- **CRON:** @nestjs/schedule
- **File parsing:** xlsx (Excel), fast-xml-parser (XML SENIAT)
- **Runtime:** Node.js 20+

## Base de datos

La base de datos PostgreSQL ya está creada en NeonDB con 54 tablas. El schema completo está al final de este documento en la sección "SCHEMA SQL COMPLETO". Las entities de TypeORM deben coincidir exactamente con ese schema.

**Convenciones de la BD:**
- Todas las PKs son UUID v4 (`gen_random_uuid()`)
- Montos monetarios: `NUMERIC(18,4)`
- Cantidades fraccionadas (pesaje/retail): `NUMERIC(12,3)`
- Timestamps: `TIMESTAMPTZ` en UTC
- Soft-delete con `is_active BOOLEAN DEFAULT TRUE`
- Kardex y audit_log son INSERT-ONLY (inmutables)

## Estructura del Proyecto

```
sigef/
├── docker-compose.yml
├── .env
├── apps/
│   ├── api/                              # NestJS Backend
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts           # JWT verification
│   │   │   │   │   └── roles.guard.ts          # RBAC permission check
│   │   │   │   ├── decorators/
│   │   │   │   │   ├── roles.decorator.ts      # @Roles('administrador')
│   │   │   │   │   └── current-user.decorator.ts # @CurrentUser()
│   │   │   │   ├── filters/
│   │   │   │   │   └── http-exception.filter.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── audit.interceptor.ts
│   │   │   │   └── pipes/
│   │   │   │       └── uuid-validation.pipe.ts
│   │   │   ├── modules/
│   │   │   │   ├── auth/
│   │   │   │   ├── users/
│   │   │   │   ├── roles/
│   │   │   │   ├── config-global/
│   │   │   │   ├── branches/
│   │   │   │   ├── terminals/
│   │   │   │   ├── exchange-rates/
│   │   │   │   ├── categories/
│   │   │   │   ├── brands/
│   │   │   │   ├── active-ingredients/
│   │   │   │   ├── products/
│   │   │   │   ├── suppliers/
│   │   │   │   ├── locations/
│   │   │   │   ├── inventory/
│   │   │   │   ├── kardex/
│   │   │   │   ├── purchase-orders/
│   │   │   │   ├── inventory-counts/
│   │   │   │   └── audit/
│   │   │   └── database/
│   │   │       ├── database.module.ts
│   │   │       ├── migrations/
│   │   │       └── seeds/
│   │   │           └── initial-seed.ts
│   │   ├── ormconfig.ts
│   │   └── package.json
│   └── web/                              # Frontend (otro contexto)
└── packages/
    └── shared/                           # Types compartidos con POS
```

## Patrón de cada módulo NestJS

Cada módulo sigue esta estructura:

```
modules/products/
├── products.module.ts
├── products.controller.ts
├── products.service.ts
├── entities/
│   └── product.entity.ts
├── dto/
│   ├── create-product.dto.ts
│   ├── update-product.dto.ts
│   └── query-product.dto.ts
```

### Entity ejemplo

```typescript
// modules/products/entities/product.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column, ManyToOne,
  JoinColumn, CreateDateColumn, UpdateDateColumn
} from 'typeorm';
import { CategoryEntity } from '../../categories/entities/category.entity';
import { BrandEntity } from '../../brands/entities/brand.entity';

@Entity('products')
export class ProductEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true, nullable: true })
  ean: string;

  @Column({ type: 'varchar', length: 300 })
  description: string;

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => CategoryEntity)
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column({ name: 'brand_id', type: 'uuid', nullable: true })
  brandId: string;

  @ManyToOne(() => BrandEntity)
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @Column({ name: 'product_type', type: 'varchar', length: 20, default: 'general' })
  productType: string;

  @Column({ name: 'is_controlled', type: 'boolean', default: false })
  isControlled: boolean;

  @Column({ name: 'is_antibiotic', type: 'boolean', default: false })
  isAntibiotic: boolean;

  @Column({ name: 'requires_recipe', type: 'boolean', default: false })
  requiresRecipe: boolean;

  @Column({ name: 'is_weighable', type: 'boolean', default: false })
  isWeighable: boolean;

  @Column({ name: 'unit_of_measure', type: 'varchar', length: 10, default: 'UND' })
  unitOfMeasure: string;

  @Column({ name: 'decimal_places', type: 'smallint', default: 0 })
  decimalPlaces: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  presentation: string;

  @Column({ name: 'tax_type', type: 'varchar', length: 15, default: 'exempt' })
  taxType: string;

  @Column({ type: 'decimal', precision: 18, scale: 4, nullable: true })
  pmvp: number;

  @Column({ name: 'conservation_type', type: 'varchar', length: 30, default: 'ambient' })
  conservationType: string;

  @Column({ name: 'stock_min', type: 'decimal', precision: 12, scale: 3, default: 0 })
  stockMin: number;

  @Column({ name: 'stock_max', type: 'decimal', precision: 12, scale: 3, nullable: true })
  stockMax: number;

  @Column({ name: 'reorder_point', type: 'decimal', precision: 12, scale: 3, nullable: true })
  reorderPoint: number;

  @Column({ name: 'lead_time_days', type: 'smallint', default: 0 })
  leadTimeDays: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'inventory_blocked', type: 'boolean', default: false })
  inventoryBlocked: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
```

### DTO ejemplo

```typescript
// modules/products/dto/create-product.dto.ts
import { IsString, IsUUID, IsOptional, IsBoolean, IsNumber, IsEnum, MaxLength, Min } from 'class-validator';

export class CreateProductDto {
  @IsOptional() @IsString() @MaxLength(20)
  ean?: string;

  @IsString() @MaxLength(300)
  description: string;

  @IsOptional() @IsString() @MaxLength(100)
  shortName?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional() @IsUUID()
  brandId?: string;

  @IsEnum(['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'])
  productType: string;

  @IsOptional() @IsBoolean()
  isControlled?: boolean;

  @IsOptional() @IsBoolean()
  isAntibiotic?: boolean;

  @IsOptional() @IsBoolean()
  isWeighable?: boolean;

  @IsEnum(['UND', 'KG', 'G', 'L', 'ML'])
  unitOfMeasure: string;

  @IsEnum(['exempt', 'general', 'reduced'])
  taxType: string;

  @IsOptional() @IsNumber() @Min(0)
  pmvp?: number;

  @IsOptional() @IsNumber() @Min(0)
  stockMin?: number;

  @IsOptional() @IsNumber() @Min(0)
  stockMax?: number;

  @IsOptional() @IsNumber() @Min(0)
  reorderPoint?: number;
}

// modules/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
export class UpdateProductDto extends PartialType(CreateProductDto) {}

// modules/products/dto/query-product.dto.ts
import { IsOptional, IsString, IsUUID, IsInt, Min, IsEnum, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class QueryProductDto {
  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsUUID()
  categoryId?: string;

  @IsOptional() @IsUUID()
  brandId?: string;

  @IsOptional() @IsEnum(['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'])
  productType?: string;

  @IsOptional() @IsEnum(['exempt', 'general', 'reduced'])
  taxType?: string;

  @IsOptional() @IsBoolean() @Type(() => Boolean)
  isActive?: boolean;

  @IsOptional() @IsEnum(['normal', 'low', 'out'])
  stockStatus?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit?: number = 20;
}
```

### Controller ejemplo

```typescript
// modules/products/products.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';

@Controller('api/products')
@UseGuards(AuthGuard, RolesGuard)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  @Roles('administrador', 'farmaceutico_regente', 'gerente_inventario', 'cajero')
  findAll(@Query() query: QueryProductDto) {
    return this.productsService.findAll(query);
  }

  @Get(':id')
  @Roles('administrador', 'farmaceutico_regente', 'gerente_inventario', 'cajero')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @Roles('administrador', 'gerente_inventario')
  create(@Body() dto: CreateProductDto, @CurrentUser() user: any) {
    return this.productsService.create(dto, user);
  }

  @Put(':id')
  @Roles('administrador', 'gerente_inventario')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    return this.productsService.update(id, dto, user);
  }

  @Delete(':id')
  @Roles('administrador')
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: any) {
    return this.productsService.softDelete(id, user);
  }
}
```

### Service ejemplo

```typescript
// modules/products/products.service.ts
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { ProductEntity } from './entities/product.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly repo: Repository<ProductEntity>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(query: QueryProductDto) {
    const qb = this.repo.createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .leftJoinAndSelect('p.brand', 'b');

    if (query.search) {
      qb.andWhere('(p.description ILIKE :search OR p.ean ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.categoryId) qb.andWhere('p.categoryId = :categoryId', { categoryId: query.categoryId });
    if (query.brandId) qb.andWhere('p.brandId = :brandId', { brandId: query.brandId });
    if (query.productType) qb.andWhere('p.productType = :productType', { productType: query.productType });
    if (query.isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });

    const page = query.page || 1;
    const limit = query.limit || 20;
    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.description', 'ASC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const product = await this.repo.findOne({
      where: { id },
      relations: ['category', 'brand'],
    });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(dto: CreateProductDto, user: any) {
    if (dto.ean) {
      const exists = await this.repo.findOne({ where: { ean: dto.ean } });
      if (exists) throw new ConflictException('EAN ya registrado');
    }
    const product = this.repo.create(dto);
    return this.repo.save(product);
  }

  async update(id: string, dto: any, user: any) {
    const old = await this.findOne(id);
    const updated = await this.repo.save({ ...old, ...dto });
    await this.auditService.log({
      tableName: 'products', recordId: id, action: 'UPDATE',
      oldValues: old, newValues: updated, userId: user.id,
    });
    return updated;
  }

  async softDelete(id: string, user: any) {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
    await this.auditService.log({
      tableName: 'products', recordId: id, action: 'DELETE',
      userId: user.id, justification: 'Soft delete',
    });
    return { success: true };
  }
}
```

### Module ejemplo

```typescript
// modules/products/products.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductEntity } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [TypeOrmModule.forFeature([ProductEntity]), AuditModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
```

## Formato de respuesta paginada

Todos los endpoints GET que listan registros usan este formato:

```json
{
  "data": [],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

## Servicios transversales

### KardexService (INSERT-ONLY)

Se invoca desde: recepción de mercancía, ajustes de inventario, toma de inventario, ventas, devoluciones.

```typescript
interface KardexEntry {
  productId: string;
  branchId: string;
  lotId?: string;
  movementType: 'purchase_entry' | 'consignment_entry' | 'sale' | 'sale_return' |
    'adjustment_in' | 'adjustment_out' | 'damage' | 'expiry_write_off' |
    'consignment_return' | 'transfer_in' | 'transfer_out';
  quantity: number; // positivo=entrada, negativo=salida
  unitCostUsd?: number;
  referenceType?: string; // 'sale_ticket', 'purchase_order', 'adjustment', 'inventory_count'
  referenceId?: string;
  notes?: string;
  userId: string;
  terminalId?: string;
}
```

Lógica:
1. Calcular `balanceAfter` = stock actual del producto/sucursal después del movimiento
2. INSERT en tabla `kardex`
3. NUNCA hacer UPDATE ni DELETE en esta tabla
4. Soportar quantity con 3 decimales

### AuditService

Se invoca en operaciones críticas: ajustes de inventario, cambios de precio, anulaciones, cambios de estado.

```typescript
interface AuditEntry {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
  justification?: string; // obligatorio para ajustes y anulaciones
  userId: string;
  terminalId?: string;
  ipAddress?: string;
}
```

## Seed Inicial

Ejecutar después de las migraciones. Debe crear:

**Roles:** administrador, farmaceutico_regente, cajero, gerente_inventario

**Permisos por módulo:**
- auth: auth.login
- admin: admin.config, admin.users, admin.roles
- products: products.view, products.create, products.edit, products.delete, products.import
- inventory: inventory.view, inventory.adjust, inventory.quarantine, inventory.count
- purchases: purchases.view, purchases.create, purchases.receive
- suppliers: suppliers.view, suppliers.create, suppliers.edit
- audit: audit.view
- pos: pos.sell, pos.void, pos.return, pos.cash_session

**Asignaciones:**
- administrador = TODOS los permisos
- farmaceutico_regente = products.* + inventory.* + audit.view
- cajero = pos.* + products.view + inventory.view
- gerente_inventario = products.* + inventory.* + purchases.* + suppliers.* + audit.view

**Usuario admin:** username='admin', password='admin123' (bcrypt hash), role=administrador

**Config global:** bcv_rate_usd='36.50', iva_general_pct='16.00', iva_reduced_pct='8.00', igtf_pct='3.00', fefo_alert_days_red='30', fefo_alert_days_yellow='60', fefo_alert_days_orange='90'

**Sucursal:** 'Farmacia SIGEF Principal', RIF='J-00000000-0'

---

## ENDPOINTS — Especificación Completa

Cada endpoint lista: ruta, método, descripción, body/query esperados, response, y lógica de negocio.

---

### AUTH

#### POST /api/auth/login
- Body: `{ username, password }`
- Response: `{ access_token, refresh_token, user: { id, username, full_name, role: { id, name } } }`
- Validar password contra bcrypt hash. JWT expira en 15min. Refresh en 7d.

#### POST /api/auth/refresh
- Body: `{ refresh_token }`
- Response: `{ access_token, refresh_token }`
- Invalidar refresh token anterior (rotación).

#### POST /api/auth/logout
- Header: `Authorization: Bearer <token>`
- Eliminar sesión de user_sessions.
- Response: `{ success: true }`

---

### USERS

#### GET /api/users
- Query: `?page=1&limit=20&role_id=&is_active=`
- Response: `{ data: [User con role_name], total, page, limit }`
- Solo: administrador

#### POST /api/users
- Body: `{ username, password, full_name, cedula, email, phone, role_id }`
- Hash password bcrypt (salt 12). Validar username y cédula únicos.

#### PUT /api/users/:id
- Body: campos parciales. Si incluye password, re-hashear.

#### DELETE /api/users/:id
- Soft-delete: `is_active = false`

---

### ROLES

#### GET /api/roles
- Response: `[{ id, name, description, permissions: [{ id, code, module }] }]`

#### POST /api/roles
- Body: `{ name, description, permission_ids: [uuid] }`

#### PUT /api/roles/:id
- Body: `{ name, description, permission_ids: [uuid] }`
- Reemplazar role_permissions (delete + insert).

---

### CONFIG GLOBAL

#### GET /api/config
- Response: `{ bcv_rate_usd: '36.50', iva_general_pct: '16.00', ... }`

#### PUT /api/config
- Body: `{ key: value, key2: value2 }` — Upsert en global_config. Solo: administrador.

---

### EXCHANGE RATES

#### GET /api/exchange-rates
- Query: `?currency_from=USD&currency_to=VES&limit=30`

#### POST /api/exchange-rates
- Body: `{ currency_from, currency_to, rate, source, effective_date }`

---

### BRANCHES

#### GET /api/branches
#### POST /api/branches — Body: `{ name, rif, address, phone, email }`
#### PUT /api/branches/:id

---

### TERMINALS

#### GET /api/terminals — Query: `?branch_id=`
#### POST /api/terminals — Body: `{ branch_id, code, name, fiscal_printer_config, scale_config, cash_drawer_config }`
#### PUT /api/terminals/:id

---

### CATEGORIES

#### GET /api/categories
- Response: árbol jerárquico `[{ id, name, code, is_pharmaceutical, parent_id, children: [...] }]`

#### POST /api/categories
- Body: `{ name, code, parent_id (nullable), is_pharmaceutical }`

#### PUT /api/categories/:id
- Validar que no se asigne a sí misma como padre.

#### DELETE /api/categories/:id
- Solo si no tiene productos ni hijos. Error 409 si tiene.

---

### BRANDS

#### GET /api/brands — Query: `?search=&is_laboratory=&page=&limit=`
#### POST /api/brands — Body: `{ name, is_laboratory }`. Nombre único.
#### PUT /api/brands/:id
#### DELETE /api/brands/:id — Solo si no tiene productos. Error 409.

---

### ACTIVE INGREDIENTS

#### GET /api/active-ingredients — Query: `?search=&page=&limit=`
#### POST /api/active-ingredients — Body: `{ name, therapeutic_group }`. Nombre único.
#### PUT /api/active-ingredients/:id
#### DELETE /api/active-ingredients/:id — Solo si no asignado a productos. Error 409.

---

### PRODUCTS

#### GET /api/products
- Query: `?page=1&limit=20&search=&category_id=&brand_id=&product_type=&tax_type=&is_active=&stock_status=(normal|low|out)`
- Response: `{ data: [Product con category_name, brand_name, total_stock], total, page, limit }`
- stock_status: 'out'=stock 0, 'low'=stock<=stock_min, 'normal'=resto
- Calcular total_stock como SUM(quantity_available) de inventory_lots activos

#### GET /api/products/:id
- Response: Product completo + `active_ingredients: [{ id, name, concentration, is_primary }]` + `substitutes: [{ id, description, ean, total_stock }]`

#### POST /api/products
- Body: TODOS los campos del maestro SKU (ver CreateProductDto arriba)
- Validar: ean único, si is_weighable=true → decimal_places=3 y unit_of_measure=KG|G
- Si product_type='controlled' → is_controlled=true y requires_recipe=true automáticamente

#### PUT /api/products/:id — Registrar en audit_log.
#### DELETE /api/products/:id — Soft delete. No si tiene lotes con stock > 0.

#### POST /api/products/:id/ingredients
- Body: `{ active_ingredient_id, concentration, is_primary }`

#### DELETE /api/products/:id/ingredients/:ingredient_id

#### GET /api/products/:id/substitutes
- Lógica: obtener principios activos del producto → buscar otros productos con mismo principio activo → filtrar con stock > 0 → excluir producto actual → ordenar por stock DESC

#### GET /api/products/search
- Query: `?q=losartan&type=name|ean|ingredient|generic`
- type=name: description ILIKE. type=ean: exacto. type=ingredient: busca en active_ingredients.name
- Si type no se especifica: buscar en todos. Limitar a 50 resultados.

#### POST /api/products/import
- multipart/form-data
- mode=preview: parsear archivo, retornar `{ columns, rows (primeras 10), total_rows, detected_mapping }`
- mode=confirm: Body `{ mapping, file_id }`. Importar. Retornar `{ imported, errors: [{ row, field, error }] }`

---

### SUPPLIERS

#### GET /api/suppliers — Query: `?search=&is_drugstore=&is_active=&page=&limit=`
#### POST /api/suppliers — Body: `{ rif, business_name, trade_name, contact_name, phone, email, address, is_drugstore, api_endpoint, payment_terms_days, consignment_commission_pct }`
#### PUT /api/suppliers/:id
#### DELETE /api/suppliers/:id — Soft delete.

#### GET /api/suppliers/:id/products
- Response: `[{ id, product_id, product_description, supplier_sku, cost_usd, last_cost_usd, discount_pct, is_available }]`

#### POST /api/suppliers/:id/products
- Body: `{ product_id, supplier_sku, cost_usd, discount_pct }`

#### PUT /api/suppliers/:id/products/:sp_id
- Guardar cost_usd anterior en last_cost_usd automáticamente.

---

### LOCATIONS

#### GET /api/locations — Query: `?branch_id=&is_quarantine=`
#### POST /api/locations — Body: `{ branch_id, aisle, shelf, section, capacity, location_code, is_quarantine }`
#### PUT /api/locations/:id

---

### INVENTORY (LOTS)

#### GET /api/inventory/lots
- Query: `?product_id=&branch_id=&status=&expiry_signal=&page=&limit=`
- Response incluye expiry_signal calculado: EXPIRED (vencido), RED (<=30d), YELLOW (<=60d), ORANGE (<=90d), GREEN (>90d)
- Ordenar por expiration_date ASC (FEFO)

#### POST /api/inventory/lots
- Body: `{ product_id, branch_id, lot_number, expiration_date, manufacture_date, acquisition_type, supplier_id, cost_usd, sale_price, quantity_received, location_id }`
- quantity_available = quantity_received. Calcular margin_pct.
- Registrar en Kardex.

#### PUT /api/inventory/lots/:id
- Body: `{ sale_price, location_id, status }`

#### PUT /api/inventory/lots/:id/quarantine
- Body: `{ quarantine: true|false, reason: 'obligatorio' }`
- Registrar en audit_log.

#### GET /api/inventory/stock-fefo
- Query: `?product_id=&branch_id=`
- Solo lotes status='available' y quantity_available > 0, ordenados por expiration_date ASC.

#### GET /api/inventory/stock
- Query: `?product_id=&branch_id=&category_id=&stock_status=`
- Aggregar: SUM(quantity_available), COUNT(lots), MIN(expiration_date)

#### POST /api/inventory/adjustments
- Body: `{ product_id, lot_id, branch_id, adjustment_type ('damage'|'correction'|'count_difference'|'expiry_write_off'), quantity (±), reason (obligatorio, min 10 chars) }`
- Actualizar quantity_available. Registrar en Kardex (adjustment_in o adjustment_out). Registrar en audit_log.
- Si producto es consignación y es faltante: flag de notificación.

---

### KARDEX

#### GET /api/inventory/kardex
- Query: `?product_id=&branch_id=&lot_id=&movement_type=&from=&to=&page=&limit=`
- Ordenado por created_at DESC.
- INMUTABLE: solo lectura.

---

### PURCHASE ORDERS

#### GET /api/purchase-orders — Query: `?branch_id=&supplier_id=&status=&order_type=&from=&to=&page=&limit=`
#### GET /api/purchase-orders/:id — Con ítems.

#### POST /api/purchase-orders
- Body: `{ branch_id, supplier_id, order_type ('purchase'|'consignment'), expected_date, notes, items: [{ product_id, quantity, unit_cost_usd, discount_pct }] }`
- Generar order_number: OC-YYYYMMDD-NNNN. Calcular totales.

#### PUT /api/purchase-orders/:id — Solo si status=draft. Para cambiar status a 'sent' o 'cancelled'.

---

### GOODS RECEIPTS

#### GET /api/goods-receipts — Query: `?branch_id=&supplier_id=&purchase_order_id=&from=&to=&page=&limit=`

#### POST /api/goods-receipts
- Body: `{ branch_id, supplier_id, purchase_order_id (nullable), supplier_invoice_number, receipt_type ('purchase'|'consignment'), items: [{ product_id, lot_number, expiration_date, quantity, unit_cost_usd, sale_price, location_id }] }`
- POR CADA ÍTEM: crear/actualizar inventory_lot → registrar en Kardex → actualizar products.cost_usd si difiere
- Si purchase_order_id: actualizar quantity_received en items de la OC, cambiar status a 'received' o 'partial'.
- TODO EN TRANSACCIÓN.

#### POST /api/goods-receipts/import
- multipart/form-data. Parsea XML SENIAT o Excel. Misma lógica que POST pero masivo.

---

### INVENTORY COUNTS (Toma de Inventario)

#### GET /api/inventory-counts — Query: `?branch_id=&count_type=&status=&from=&to=&page=&limit=`

#### POST /api/inventory-counts
- Body: `{ branch_id, count_type ('total'|'partial'|'cyclic'), scope_description, scope_category_id, scope_location_ids, scope_abc_classes, scope_risk_levels, blocks_sales, notes }`
- Generar count_number: INV-YYYYMMDD-NNN
- Generar inventory_count_items automáticamente: un registro por cada SKU/lote en alcance con expected_quantity = quantity_available actual (snapshot)
- Setear total_skus_expected

#### GET /api/inventory-counts/:id — Con ítems y resumen de contados/pendientes.

#### PUT /api/inventory-counts/:id/start
- status → 'in_progress'. Si blocks_sales=true: UPDATE products SET inventory_blocked=true para SKUs del alcance.

#### PUT /api/inventory-counts/:id/items/:item_id
- Body: `{ counted_quantity, counted_lot_number, counted_expiration_date, device_type }`
- Calcular difference = counted - expected. Determinar difference_type (match/over/short).

#### PUT /api/inventory-counts/:id/items/:item_id/recount
- Body: `{ recount_reason }`. Limpiar conteo anterior.

#### PUT /api/inventory-counts/:id/complete
- Validar TODO contado. Calcular métricas: matched, over, short, accuracy_pct.

#### PUT /api/inventory-counts/:id/approve
- Body: `{ apply_adjustments: true|false, notes }`
- Si apply_adjustments: generar ajuste de inventario por cada discrepancia (via POST /api/inventory/adjustments interno). Si consignación con faltante: notificación proveedor.
- Desbloquear SKUs si blocks_sales era true.

#### PUT /api/inventory-counts/:id/cancel
- Desbloquear SKUs si estaban bloqueados.

#### GET /api/inventory-counts/cyclic-schedules — Query: `?branch_id=&is_active=`
#### POST /api/inventory-counts/cyclic-schedules — Body: `{ branch_id, name, abc_classes, risk_levels, frequency_days, max_skus_per_count, auto_generate }`
#### PUT /api/inventory-counts/cyclic-schedules/:id

#### GET /api/inventory-counts/accuracy
- Query: `?branch_id=&from=&to=`
- Response: `{ avg_accuracy_pct, total_counts, total_adjustments, total_variance_usd, trend: [{ date, accuracy_pct }] }`

---

### AUDIT LOG

#### GET /api/audit-log
- Query: `?table_name=&record_id=&action=&user_id=&from=&to=&page=&limit=`
- Solo lectura. Ordenado por created_at DESC.

---

## CRON Jobs

### /jobs/expiry-alerts (diario, 6:00 AM)
Buscar lotes available con stock > 0, calcular días hasta vencimiento. Lotes con <=0 días: cambiar status a 'expired', registrar en Kardex como 'expiry_write_off'.

### /jobs/cyclic-counts (diario, 7:00 AM)
Consultar inventory_cyclic_schedules donde auto_generate=true y next_generation_at <= now(). Generar inventory_count tipo 'cyclic' con SKUs que coincidan con abc_classes/risk_levels.

---

## SCHEMA SQL COMPLETO (PostgreSQL — NeonDB)

Este es el schema exacto que ya está desplegado. Las entities de TypeORM deben coincidir.

```sql
-- ============================================================================
-- SIGEF - Sistema Integrado de Gestión Farmacéutica
-- PostgreSQL Database Schema v2.1
-- Fecha: 2026-04-06
-- ============================================================================
-- Convenciones:
--   • PK: UUID v4 (gen_random_uuid()) en TODAS las tablas
--   • Timestamps: timestamptz (UTC) con DEFAULT now()
--   • Soft-delete: campo is_active / deleted_at donde aplique
--   • Montos monetarios: NUMERIC(18,4) para precisión decimal
--   • Cantidades fraccionadas (retail/pesaje): NUMERIC(12,3)
--   • Auditoría inmutable vía tabla audit_log
-- ============================================================================

-- Extensiones requeridas
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgaudit";     -- auditoría a nivel SQL

-- ============================================================================
-- 1. SEGURIDAD, ROLES Y AUTENTICACIÓN (RBAC)
-- ============================================================================

CREATE TABLE roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(50) NOT NULL UNIQUE,  -- 'administrador','farmaceutico_regente','cajero','gerente_inventario'
    description     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE permissions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(100) NOT NULL UNIQUE,  -- ej. 'pos.sell', 'inventory.adjust', 'crm.view_patients'
    description     TEXT,
    module          VARCHAR(50) NOT NULL,           -- 'pos','inventory','crm','bi','queues','admin','reports'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE role_permissions (
    role_id         UUID NOT NULL REFERENCES roles(id),
    permission_id   UUID NOT NULL REFERENCES permissions(id),
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username        VARCHAR(50) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    cedula          VARCHAR(20) UNIQUE,
    email           VARCHAR(150),
    phone           VARCHAR(20),
    role_id         UUID NOT NULL REFERENCES roles(id),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id),
    token_hash      VARCHAR(255) NOT NULL,
    ip_address      INET,
    terminal_id     UUID,  -- FK a terminals
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. SUCURSALES, TERMINALES Y CONFIGURACIÓN
-- ============================================================================

CREATE TABLE branches (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL,
    rif             VARCHAR(20) NOT NULL,       -- J-12345678-9
    address         TEXT NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(150),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE terminals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    code            VARCHAR(20) NOT NULL UNIQUE,   -- 'CAJA-01'
    name            VARCHAR(100),
    fiscal_printer_config   JSONB,    -- {model, port, baud_rate, protocol}
    scale_config            JSONB,    -- {model, port, baud_rate}
    cash_drawer_config      JSONB,    -- {port, pulse_duration}
    last_sync_at    TIMESTAMPTZ,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE global_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(100) NOT NULL UNIQUE,
    value           TEXT NOT NULL,
    description     TEXT,
    data_type       VARCHAR(20) NOT NULL DEFAULT 'string', -- 'string','number','boolean','json'
    updated_by      UUID REFERENCES users(id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ejemplos de config: 'bcv_rate_usd', 'igtf_rate', 'iva_general', 'iva_reducido', 'fefo_alert_days_30/60/90'

CREATE TABLE exchange_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_from   VARCHAR(3) NOT NULL DEFAULT 'USD',
    currency_to     VARCHAR(3) NOT NULL DEFAULT 'VES',
    rate            NUMERIC(18,4) NOT NULL,
    source          VARCHAR(50) NOT NULL DEFAULT 'BCV',  -- 'BCV','manual'
    effective_date  DATE NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exchange_rates_date ON exchange_rates(effective_date DESC);

-- ============================================================================
-- 3. MAESTRO DE PRODUCTOS / SKU
-- ============================================================================

CREATE TABLE categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id       UUID REFERENCES categories(id),
    name            VARCHAR(100) NOT NULL,
    code            VARCHAR(20),
    is_pharmaceutical BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE brands (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    is_laboratory   BOOLEAN NOT NULL DEFAULT FALSE,  -- TRUE para laboratorios farmacéuticos
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE active_ingredients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,     -- 'Losartán Potásico'
    therapeutic_group VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ean             VARCHAR(20) UNIQUE,               -- Código de barras EAN-13/EAN-8
    internal_code   VARCHAR(30) UNIQUE,
    description     VARCHAR(300) NOT NULL,
    short_name      VARCHAR(100),
    category_id     UUID NOT NULL REFERENCES categories(id),
    brand_id        UUID REFERENCES brands(id),

    -- Tipo de producto
    product_type    VARCHAR(20) NOT NULL DEFAULT 'general',
        -- 'pharmaceutical','controlled','otc','grocery','miscellaneous','weighable'
    is_controlled   BOOLEAN NOT NULL DEFAULT FALSE,    -- Psicotrópico/Estupefaciente
    is_antibiotic   BOOLEAN NOT NULL DEFAULT FALSE,    -- Requiere récipe
    requires_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    is_weighable    BOOLEAN NOT NULL DEFAULT FALSE,    -- Venta por peso

    -- Unidades de medida
    unit_of_measure VARCHAR(10) NOT NULL DEFAULT 'UND', -- 'UND','KG','G','L','ML'
    decimal_places  SMALLINT NOT NULL DEFAULT 0,        -- 0 para unidades, 3 para pesables
    presentation    VARCHAR(100),                       -- 'Caja x 30 tabs', '500ml'

    -- Fiscal
    tax_type        VARCHAR(15) NOT NULL DEFAULT 'exempt',
        -- 'exempt' (medicamentos), 'general' (16%), 'reduced' (8%)
    pmvp            NUMERIC(18,4),                      -- Precio Máximo de Venta al Público regulado

    -- Salud y conservación
    conservation_type VARCHAR(30) DEFAULT 'ambient',    -- 'ambient','cold_chain','frozen'
    min_temperature NUMERIC(5,2),
    max_temperature NUMERIC(5,2),

    -- Operativa
    stock_min       NUMERIC(12,3) NOT NULL DEFAULT 0,
    stock_max       NUMERIC(12,3),
    reorder_point   NUMERIC(12,3),
    lead_time_days  SMALLINT DEFAULT 0,

    -- Estado
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    inventory_blocked BOOLEAN NOT NULL DEFAULT FALSE,  -- Bloqueo por toma de inventario (no facturable)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_ean ON products(ean);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_products_blocked ON products(inventory_blocked) WHERE inventory_blocked = TRUE;

-- Relación M:N productos ↔ principios activos (sustitución)
CREATE TABLE product_active_ingredients (
    product_id          UUID NOT NULL REFERENCES products(id),
    active_ingredient_id UUID NOT NULL REFERENCES active_ingredients(id),
    concentration       VARCHAR(50),    -- '50mg', '100mg/5ml'
    is_primary          BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (product_id, active_ingredient_id)
);

-- Sustitutos explícitos (mismo principio activo, distinta marca)
CREATE TABLE product_substitutes (
    product_id      UUID NOT NULL REFERENCES products(id),
    substitute_id   UUID NOT NULL REFERENCES products(id),
    priority        SMALLINT NOT NULL DEFAULT 1,
    PRIMARY KEY (product_id, substitute_id),
    CHECK (product_id <> substitute_id)
);

-- ============================================================================
-- 4. PROVEEDORES Y DROGUERÍAS
-- ============================================================================

CREATE TABLE suppliers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rif             VARCHAR(20) NOT NULL UNIQUE,
    business_name   VARCHAR(200) NOT NULL,
    trade_name      VARCHAR(200),
    contact_name    VARCHAR(150),
    phone           VARCHAR(20),
    email           VARCHAR(150),
    address         TEXT,
    is_drugstore    BOOLEAN NOT NULL DEFAULT FALSE,   -- Droguería con API B2B
    api_endpoint    VARCHAR(500),
    api_key_encrypted TEXT,                            -- Cifrado AES-256
    payment_terms_days SMALLINT DEFAULT 30,
    consignment_commission_pct NUMERIC(5,2),          -- % comisión en consignación
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Relación M:N proveedor ↔ producto con precios
CREATE TABLE supplier_products (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    supplier_sku    VARCHAR(50),
    cost_usd        NUMERIC(18,4),
    last_cost_usd   NUMERIC(18,4),
    discount_pct    NUMERIC(5,2) DEFAULT 0,
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    last_updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (supplier_id, product_id)
);

-- ============================================================================
-- 5. INVENTARIO: LOTES, STOCK, KARDEX, UBICACIONES, CONSIGNACIONES
-- ============================================================================

CREATE TABLE warehouse_locations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    aisle           VARCHAR(10),        -- Pasillo
    shelf           VARCHAR(10),        -- Estante
    section         VARCHAR(10),        -- Tramo
    capacity        NUMERIC(12,3),
    location_code   VARCHAR(30) NOT NULL,
    is_quarantine   BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, location_code)
);

CREATE TABLE inventory_lots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    lot_number      VARCHAR(50) NOT NULL,
    expiration_date DATE NOT NULL,
    manufacture_date DATE,

    -- Propio vs Consignado
    acquisition_type VARCHAR(15) NOT NULL DEFAULT 'purchase',
        -- 'purchase','consignment'
    supplier_id     UUID REFERENCES suppliers(id),
    consignment_entry_id UUID,  -- FK a consignment_entries (se crea abajo)

    -- Costos
    cost_usd        NUMERIC(18,4) NOT NULL DEFAULT 0,
    sale_price      NUMERIC(18,4) NOT NULL,
    margin_pct      NUMERIC(5,2),

    -- Stock
    quantity_received   NUMERIC(12,3) NOT NULL,
    quantity_available  NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_reserved   NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_sold       NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_damaged    NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_returned   NUMERIC(12,3) NOT NULL DEFAULT 0,

    -- Ubicación
    location_id     UUID REFERENCES warehouse_locations(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'available',
        -- 'available','quarantine','expired','returned','depleted'

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, branch_id, lot_number)
);
CREATE INDEX idx_inventory_lots_expiration ON inventory_lots(expiration_date);
CREATE INDEX idx_inventory_lots_product ON inventory_lots(product_id, branch_id);
CREATE INDEX idx_inventory_lots_status ON inventory_lots(status);

-- Vista de stock actual por producto/sucursal (FEFO order)
CREATE VIEW v_stock_fefo AS
SELECT
    product_id, branch_id, lot_number, expiration_date,
    acquisition_type, supplier_id,
    quantity_available,
    CASE
        WHEN expiration_date <= CURRENT_DATE THEN 'EXPIRED'
        WHEN expiration_date <= CURRENT_DATE + INTERVAL '30 days' THEN 'RED'
        WHEN expiration_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'YELLOW'
        WHEN expiration_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'ORANGE'
        ELSE 'GREEN'
    END AS expiry_signal
FROM inventory_lots
WHERE status = 'available' AND quantity_available > 0
ORDER BY product_id, branch_id, expiration_date ASC;  -- FEFO

-- Kardex inmutable
CREATE TABLE kardex (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    lot_id          UUID REFERENCES inventory_lots(id),
    movement_type   VARCHAR(30) NOT NULL,
        -- 'purchase_entry','consignment_entry','sale','sale_return',
        -- 'adjustment_in','adjustment_out','transfer_in','transfer_out',
        -- 'damage','expiry_write_off','consignment_return'
    quantity         NUMERIC(12,3) NOT NULL,   -- Positivo=entrada, Negativo=salida
    unit_cost_usd    NUMERIC(18,4),
    balance_after    NUMERIC(12,3) NOT NULL,
    reference_type   VARCHAR(50),               -- 'sale_ticket','purchase_order','adjustment'
    reference_id     UUID,                      -- ID del documento fuente
    notes            TEXT,
    user_id          UUID NOT NULL REFERENCES users(id),
    terminal_id      UUID REFERENCES terminals(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    -- SIN UPDATE/DELETE: inmutable
);
CREATE INDEX idx_kardex_product ON kardex(product_id, branch_id, created_at);

-- ============================================================================
-- 6. CONSIGNACIONES
-- ============================================================================

CREATE TABLE consignment_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    entry_number    VARCHAR(30) NOT NULL UNIQUE,
    entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    commission_pct  NUMERIC(5,2) NOT NULL,        -- % ganancia de la farmacia
    notes           TEXT,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
        -- 'active','partially_liquidated','liquidated','returned'
    total_items     INTEGER NOT NULL DEFAULT 0,
    total_cost_usd  NUMERIC(18,4) NOT NULL DEFAULT 0,
    received_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consignment_entry_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consignment_entry_id UUID NOT NULL REFERENCES consignment_entries(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES inventory_lots(id),
    quantity        NUMERIC(12,3) NOT NULL,
    cost_usd        NUMERIC(18,4) NOT NULL,
    quantity_sold   NUMERIC(12,3) NOT NULL DEFAULT 0,
    quantity_returned NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Liquidaciones periódicas de consignación
CREATE TABLE consignment_liquidations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    liquidation_number VARCHAR(30) NOT NULL UNIQUE,
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    total_sold_usd  NUMERIC(18,4) NOT NULL DEFAULT 0,
    commission_usd  NUMERIC(18,4) NOT NULL DEFAULT 0,   -- Ganancia farmacia
    amount_due_usd  NUMERIC(18,4) NOT NULL DEFAULT 0,   -- Adeudado al proveedor
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft','approved','paid','cancelled'
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consignment_liquidation_items (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    liquidation_id      UUID NOT NULL REFERENCES consignment_liquidations(id),
    consignment_item_id UUID NOT NULL REFERENCES consignment_entry_items(id),
    sale_ticket_item_id UUID,   -- FK a sale_ticket_items
    quantity_liquidated NUMERIC(12,3) NOT NULL,
    sale_price_usd      NUMERIC(18,4) NOT NULL,
    cost_usd            NUMERIC(18,4) NOT NULL,
    commission_usd      NUMERIC(18,4) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devoluciones de consignación al proveedor
CREATE TABLE consignment_returns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consignment_entry_id UUID NOT NULL REFERENCES consignment_entries(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    return_number   VARCHAR(30) NOT NULL UNIQUE,
    return_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    reason          VARCHAR(50) NOT NULL,  -- 'near_expiry','damaged','supplier_request','overstock'
    notes           TEXT,
    processed_by    UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE consignment_return_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id       UUID NOT NULL REFERENCES consignment_returns(id),
    consignment_item_id UUID NOT NULL REFERENCES consignment_entry_items(id),
    lot_id          UUID NOT NULL REFERENCES inventory_lots(id),
    quantity        NUMERIC(12,3) NOT NULL,
    cost_usd        NUMERIC(18,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 7. COMPRAS (ÓRDENES DE COMPRA Y RECEPCIÓN)
-- ============================================================================

CREATE TABLE purchase_orders (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    order_number    VARCHAR(30) NOT NULL UNIQUE,
    order_date      DATE NOT NULL DEFAULT CURRENT_DATE,
    expected_date   DATE,
    order_type      VARCHAR(15) NOT NULL DEFAULT 'purchase',
        -- 'purchase','consignment'
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft','sent','partial','received','cancelled'
    subtotal_usd    NUMERIC(18,4) NOT NULL DEFAULT 0,
    tax_usd         NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_usd       NUMERIC(18,4) NOT NULL DEFAULT 0,
    notes           TEXT,
    generated_by    VARCHAR(20) DEFAULT 'manual', -- 'manual','matrix_auto','bi_suggestion'
    created_by      UUID NOT NULL REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE purchase_order_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id        UUID NOT NULL REFERENCES purchase_orders(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    quantity        NUMERIC(12,3) NOT NULL,
    unit_cost_usd   NUMERIC(18,4) NOT NULL,
    discount_pct    NUMERIC(5,2) DEFAULT 0,
    subtotal_usd    NUMERIC(18,4) NOT NULL,
    quantity_received NUMERIC(12,3) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Recepción de mercancía (puede venir de XML/Excel)
CREATE TABLE goods_receipts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    purchase_order_id UUID REFERENCES purchase_orders(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    receipt_number  VARCHAR(30) NOT NULL UNIQUE,
    receipt_date    DATE NOT NULL DEFAULT CURRENT_DATE,
    supplier_invoice_number VARCHAR(50),
    receipt_type    VARCHAR(15) NOT NULL DEFAULT 'purchase',
        -- 'purchase','consignment'
    import_source   VARCHAR(20), -- 'manual','xml','excel'
    total_usd       NUMERIC(18,4) NOT NULL DEFAULT 0,
    notes           TEXT,
    received_by     UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE goods_receipt_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id      UUID NOT NULL REFERENCES goods_receipts(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_number      VARCHAR(50) NOT NULL,
    expiration_date DATE NOT NULL,
    quantity        NUMERIC(12,3) NOT NULL,
    unit_cost_usd   NUMERIC(18,4) NOT NULL,
    sale_price      NUMERIC(18,4) NOT NULL,
    lot_id          UUID REFERENCES inventory_lots(id),   -- Lote creado/actualizado
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 8. MATRIZ ABC-XYZ (MOTOR INTELIGENTE DE CATEGORIZACIÓN)
-- ============================================================================

CREATE TABLE product_abc_xyz (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,

    -- Nivel 1: Clasificación Comercial
    commercial_score    NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0-100
    rotation_score      NUMERIC(5,2) DEFAULT 0,
    sales_volume_score  NUMERIC(5,2) DEFAULT 0,
    margin_score        NUMERIC(5,2) DEFAULT 0,
    frequency_score     NUMERIC(5,2) DEFAULT 0,
    abc_class           CHAR(1) NOT NULL,  -- 'A','B','C','D'

    -- Nivel 2: Comportamiento de Demanda
    demand_cv           NUMERIC(8,4),       -- Coeficiente de variación
    xyz_class           CHAR(1) NOT NULL,   -- 'X','Y','Z'

    -- Nivel 3: Riesgo Logístico/Sanitario
    risk_level          VARCHAR(10) NOT NULL DEFAULT 'normal',
        -- 'normal','sensitive','critical'

    -- Nivel 4: Política de Compra Derivada
    purchase_policy     VARCHAR(20) NOT NULL,
        -- 'auto_reorder','scheduled','restricted','blocked'

    is_current          BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, branch_id, evaluation_date)
);
CREATE INDEX idx_abc_xyz_current ON product_abc_xyz(product_id, branch_id) WHERE is_current = TRUE;

-- ============================================================================
-- 9. PUNTO DE VENTA (POS) - TICKETS DE VENTA
-- ============================================================================

CREATE TABLE sale_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    terminal_id     UUID NOT NULL REFERENCES terminals(id),
    cashier_id      UUID NOT NULL REFERENCES users(id),
    customer_id     UUID,   -- FK a customers (CRM)
    queue_ticket_id UUID,   -- FK a queue_tickets

    ticket_number   VARCHAR(30) NOT NULL,
    ticket_date     TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Totales
    subtotal_exempt_bs   NUMERIC(18,4) NOT NULL DEFAULT 0,
    subtotal_taxable_bs  NUMERIC(18,4) NOT NULL DEFAULT 0,
    subtotal_reduced_bs  NUMERIC(18,4) NOT NULL DEFAULT 0,
    iva_general_bs       NUMERIC(18,4) NOT NULL DEFAULT 0,  -- 16%
    iva_reduced_bs       NUMERIC(18,4) NOT NULL DEFAULT 0,  -- 8%
    igtf_bs              NUMERIC(18,4) NOT NULL DEFAULT 0,  -- 3% sobre divisas
    total_bs             NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_usd            NUMERIC(18,4) NOT NULL DEFAULT 0,
    exchange_rate_used   NUMERIC(18,4) NOT NULL,

    -- Seguros
    insurance_claim_id   UUID,   -- FK a insurance_claims

    -- Fiscal
    fiscal_printer_serial VARCHAR(50),
    fiscal_invoice_number VARCHAR(30),
    fiscal_printed        BOOLEAN NOT NULL DEFAULT FALSE,

    -- Sincronización
    is_synced        BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at        TIMESTAMPTZ,
    local_created_at TIMESTAMPTZ,  -- Timestamp del SQLite local

    status           VARCHAR(15) NOT NULL DEFAULT 'completed',
        -- 'in_progress','completed','voided'
    void_reason      TEXT,
    voided_by        UUID REFERENCES users(id),
    voided_at        TIMESTAMPTZ,

    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (terminal_id, ticket_number)
);
CREATE INDEX idx_sale_tickets_date ON sale_tickets(ticket_date);
CREATE INDEX idx_sale_tickets_customer ON sale_tickets(customer_id);
CREATE INDEX idx_sale_tickets_sync ON sale_tickets(is_synced) WHERE is_synced = FALSE;

CREATE TABLE sale_ticket_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES sale_tickets(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES inventory_lots(id),

    quantity        NUMERIC(12,3) NOT NULL,
    unit_price_bs   NUMERIC(18,4) NOT NULL,
    unit_price_usd  NUMERIC(18,4) NOT NULL,
    discount_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
    subtotal_bs     NUMERIC(18,4) NOT NULL,
    tax_type        VARCHAR(15) NOT NULL,       -- 'exempt','general','reduced'
    tax_amount_bs   NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Pesaje
    is_weighed      BOOLEAN NOT NULL DEFAULT FALSE,
    weight_kg       NUMERIC(12,3),

    -- Consignación tracking
    is_consignment  BOOLEAN NOT NULL DEFAULT FALSE,
    consignment_item_id UUID REFERENCES consignment_entry_items(id),

    -- Dispensación controlada
    requires_recipe BOOLEAN NOT NULL DEFAULT FALSE,
    recipe_record_id UUID,  -- FK a controlled_dispensations

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sale_ticket_items_ticket ON sale_ticket_items(ticket_id);

-- Métodos de pago por ticket (soporte mixto)
CREATE TABLE sale_payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES sale_tickets(id),
    payment_method  VARCHAR(30) NOT NULL,
        -- 'cash_bs','cash_usd','cash_eur','debit','credit',
        -- 'pago_movil','zelle','transfer_bs','transfer_usd'
    amount_bs       NUMERIC(18,4) NOT NULL,
    amount_currency NUMERIC(18,4),             -- Monto en moneda original
    currency        VARCHAR(3) NOT NULL DEFAULT 'VES',
    exchange_rate   NUMERIC(18,4),
    is_foreign_currency BOOLEAN NOT NULL DEFAULT FALSE,
    igtf_amount_bs  NUMERIC(18,4) NOT NULL DEFAULT 0,  -- IGTF solo si divisa
    reference_number VARCHAR(50),
    bank_terminal_id VARCHAR(50),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Devoluciones / Notas de crédito
CREATE TABLE sale_returns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_ticket_id UUID NOT NULL REFERENCES sale_tickets(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    terminal_id     UUID NOT NULL REFERENCES terminals(id),
    return_number   VARCHAR(30) NOT NULL UNIQUE,
    return_date     TIMESTAMPTZ NOT NULL DEFAULT now(),
    total_refund_bs NUMERIC(18,4) NOT NULL,
    reason          TEXT NOT NULL,
    processed_by    UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sale_return_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id       UUID NOT NULL REFERENCES sale_returns(id),
    original_item_id UUID NOT NULL REFERENCES sale_ticket_items(id),
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES inventory_lots(id),
    quantity        NUMERIC(12,3) NOT NULL,
    refund_amount_bs NUMERIC(18,4) NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 10. DISPENSACIÓN CONTROLADA (RÉCIPES Y PSICOTRÓPICOS)
-- ============================================================================

CREATE TABLE prescribers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula          VARCHAR(20) NOT NULL UNIQUE,
    full_name       VARCHAR(200) NOT NULL,
    medical_license VARCHAR(50) NOT NULL,       -- Matrícula del Colegio
    specialty       VARCHAR(100),
    phone           VARCHAR(20),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE controlled_dispensations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID NOT NULL REFERENCES sale_tickets(id),
    ticket_item_id  UUID NOT NULL REFERENCES sale_ticket_items(id),
    product_id      UUID NOT NULL REFERENCES products(id),

    prescriber_id   UUID NOT NULL REFERENCES prescribers(id),
    patient_name    VARCHAR(200) NOT NULL,
    patient_cedula  VARCHAR(20) NOT NULL,

    -- Récipe fotográfico (almacenamiento de imagen)
    recipe_image_path   TEXT NOT NULL,           -- Ruta al archivo cifrado
    recipe_image_hash   VARCHAR(64),             -- SHA-256 para integridad
    capture_method      VARCHAR(20) NOT NULL,    -- 'camera','scanner'

    dispensation_type   VARCHAR(20) NOT NULL,     -- 'antibiotic','psychotropic','narcotic'
    sacs_book_entry     BOOLEAN NOT NULL DEFAULT FALSE,
    sacs_folio_number   VARCHAR(20),

    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 11. SEGUROS
-- ============================================================================

CREATE TABLE insurance_companies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    rif             VARCHAR(20),
    contact_phone   VARCHAR(20),
    contact_email   VARCHAR(150),
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE insurance_claims (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID REFERENCES sale_tickets(id),
    customer_id     UUID,       -- FK a customers
    insurance_id    UUID NOT NULL REFERENCES insurance_companies(id),
    policy_number   VARCHAR(50),
    claim_type      VARCHAR(30) NOT NULL,   -- 'deductible','letter_of_guarantee','emergency_key'
    authorization_code VARCHAR(50),
    covered_amount_bs   NUMERIC(18,4) NOT NULL DEFAULT 0,
    patient_copay_bs    NUMERIC(18,4) NOT NULL DEFAULT 0,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        -- 'pending','approved','rejected','partial'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 12. SISTEMA DE COLAS / TURNOS
-- ============================================================================

CREATE TABLE queue_categories (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    code            CHAR(1) NOT NULL,   -- 'A','B','C','P'
    name            VARCHAR(50) NOT NULL,  -- 'Farmacia','Caja General','Seguros','Prioridad'
    priority_weight SMALLINT NOT NULL DEFAULT 1,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, code)
);

CREATE TABLE queue_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    category_id     UUID NOT NULL REFERENCES queue_categories(id),
    ticket_code     VARCHAR(10) NOT NULL,  -- 'A-042'
    ticket_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    status          VARCHAR(20) NOT NULL DEFAULT 'waiting',
        -- 'waiting','called','serving','completed','no_show'
    issued_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    called_at       TIMESTAMPTZ,
    serving_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    called_by       UUID REFERENCES users(id),       -- Cajero que llamó
    terminal_id     UUID REFERENCES terminals(id),
    wait_time_seconds   INTEGER,                     -- Calculado al llamar
    service_time_seconds INTEGER,                    -- Calculado al completar
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_queue_tickets_date ON queue_tickets(branch_id, ticket_date, status);

-- Métricas de colas (agregadas por período)
CREATE TABLE queue_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    category_id     UUID NOT NULL REFERENCES queue_categories(id),
    metric_date     DATE NOT NULL,
    hour_of_day     SMALLINT,                        -- 0-23, NULL para métrica diaria
    tickets_issued  INTEGER NOT NULL DEFAULT 0,
    tickets_served  INTEGER NOT NULL DEFAULT 0,
    tickets_no_show INTEGER NOT NULL DEFAULT 0,
    avg_wait_seconds    NUMERIC(10,2),
    max_wait_seconds    INTEGER,
    avg_service_seconds NUMERIC(10,2),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, category_id, metric_date, hour_of_day)
);

-- ============================================================================
-- 13. CRM B2C - CLIENTES Y SEGUIMIENTO CLÍNICO
-- ============================================================================

CREATE TABLE customers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cedula          VARCHAR(20) UNIQUE,
    full_name       VARCHAR(200) NOT NULL,
    birth_date      DATE,
    gender          CHAR(1),                   -- 'M','F','O'
    phone           VARCHAR(20),
    email           VARCHAR(150),
    address         TEXT,

    -- Datos clínicos (cifrado AES-256 en la app)
    health_data_encrypted   TEXT,               -- JSON cifrado: patologías, alergias, etc.

    -- Consentimiento
    marketing_opt_in        BOOLEAN NOT NULL DEFAULT FALSE,
    opt_in_date             TIMESTAMPTZ,
    opt_in_method           VARCHAR(20),        -- 'in_store','whatsapp','email'

    -- Seguros
    insurance_id    UUID REFERENCES insurance_companies(id),
    policy_number   VARCHAR(50),

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_customers_cedula ON customers(cedula);
CREATE INDEX idx_customers_phone ON customers(phone);

CREATE TABLE customer_pathologies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    pathology_name  VARCHAR(100) NOT NULL,   -- 'Hipertensión','Diabetes Tipo 2'
    icd10_code      VARCHAR(10),             -- Código CIE-10
    diagnosed_date  DATE,
    is_chronic      BOOLEAN NOT NULL DEFAULT TRUE,
    notes_encrypted TEXT,                     -- Notas cifradas
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tratamientos activos (para algoritmo de recompra)
CREATE TABLE customer_treatments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    pathology_id    UUID REFERENCES customer_pathologies(id),
    product_id      UUID NOT NULL REFERENCES products(id),

    -- Posología
    dosage          VARCHAR(100) NOT NULL,     -- '1 tableta'
    frequency       VARCHAR(50) NOT NULL,      -- 'cada 12 horas', 'diario'
    daily_quantity  NUMERIC(8,3) NOT NULL,     -- Cantidad diaria calculada
    treatment_start DATE NOT NULL,
    treatment_end   DATE,                      -- NULL = crónico indefinido

    -- Recompra
    last_purchase_date      DATE,
    last_purchase_quantity  NUMERIC(12,3),
    estimated_depletion_date DATE,             -- Calculado: last_purchase_date + (qty / daily_qty)
    next_reminder_date       DATE,

    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Campañas de marketing automatizadas
CREATE TABLE marketing_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    campaign_type   VARCHAR(30) NOT NULL,
        -- 'repurchase_reminder','pathology_promo','general','new_product'
    channel         VARCHAR(20) NOT NULL,       -- 'whatsapp','email','sms'
    target_pathology VARCHAR(100),              -- Segmentación por patología
    message_template TEXT NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'draft',
        -- 'draft','scheduled','running','completed','cancelled'
    scheduled_at    TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent      INTEGER DEFAULT 0,
    total_opened    INTEGER DEFAULT 0,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE marketing_campaign_recipients (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id     UUID NOT NULL REFERENCES marketing_campaigns(id),
    customer_id     UUID NOT NULL REFERENCES customers(id),
    treatment_id    UUID REFERENCES customer_treatments(id),
    sent_at         TIMESTAMPTZ,
    delivered_at    TIMESTAMPTZ,
    opened_at       TIMESTAMPTZ,
    status          VARCHAR(15) NOT NULL DEFAULT 'pending',
        -- 'pending','sent','delivered','opened','failed','opted_out'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 14. BUSINESS INTELLIGENCE B2B - COMPARADOR DE PRECIOS
-- ============================================================================

CREATE TABLE bi_price_comparisons (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id      UUID NOT NULL REFERENCES products(id),
    queried_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    queried_by      UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bi_price_comparison_results (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comparison_id   UUID NOT NULL REFERENCES bi_price_comparisons(id),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    cost_usd        NUMERIC(18,4),
    discount_pct    NUMERIC(5,2),
    net_cost_usd    NUMERIC(18,4),
    is_available    BOOLEAN NOT NULL DEFAULT TRUE,
    delivery_days   SMALLINT,
    fetched_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    raw_response    JSONB       -- Respuesta cruda de la API
);

-- Rate limiting para APIs de droguerías
CREATE TABLE bi_api_rate_limits (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    endpoint        VARCHAR(300) NOT NULL,
    max_requests_per_minute SMALLINT NOT NULL DEFAULT 60,
    max_requests_per_hour   SMALLINT NOT NULL DEFAULT 500,
    current_minute_count    SMALLINT NOT NULL DEFAULT 0,
    current_hour_count      SMALLINT NOT NULL DEFAULT 0,
    minute_reset_at TIMESTAMPTZ,
    hour_reset_at   TIMESTAMPTZ,
    last_request_at TIMESTAMPTZ,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 15. CUENTAS POR PAGAR
-- ============================================================================

CREATE TABLE accounts_payable (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id     UUID NOT NULL REFERENCES suppliers(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    document_type   VARCHAR(30) NOT NULL,
        -- 'purchase_invoice','consignment_liquidation','expense'
    document_reference_id UUID,               -- FK polimórfica
    document_number VARCHAR(50),
    invoice_date    DATE NOT NULL,
    due_date        DATE NOT NULL,
    amount_usd      NUMERIC(18,4) NOT NULL,
    amount_bs       NUMERIC(18,4),
    amount_paid_usd NUMERIC(18,4) NOT NULL DEFAULT 0,
    balance_usd     NUMERIC(18,4) NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'pending',
        -- 'pending','partial','paid','cancelled'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE payment_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payable_id      UUID NOT NULL REFERENCES accounts_payable(id),
    payment_date    DATE NOT NULL,
    amount_usd      NUMERIC(18,4) NOT NULL,
    payment_method  VARCHAR(30) NOT NULL,
    reference_number VARCHAR(50),
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 16. REPORTES FISCALES Y LIBROS REGULATORIOS
-- ============================================================================

CREATE TABLE fiscal_reports (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id     UUID NOT NULL REFERENCES terminals(id),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    report_type     CHAR(1) NOT NULL,   -- 'X','Z'
    report_date     TIMESTAMPTZ NOT NULL,
    fiscal_serial   VARCHAR(50) NOT NULL,
    report_number   INTEGER NOT NULL,

    -- Desglose
    total_sales_bs      NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_exempt_bs     NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_taxable_bs    NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_reduced_bs    NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_iva_bs        NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_igtf_bs       NUMERIC(18,4) NOT NULL DEFAULT 0,
    total_voided        INTEGER NOT NULL DEFAULT 0,
    total_returns_bs    NUMERIC(18,4) NOT NULL DEFAULT 0,

    -- Desglose por método de pago
    payment_breakdown   JSONB,

    raw_data        JSONB,
    generated_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Libros IVA Compra/Venta
CREATE TABLE tax_books (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    book_type       VARCHAR(10) NOT NULL,   -- 'purchase','sale'
    period_year     SMALLINT NOT NULL,
    period_month    SMALLINT NOT NULL,
    status          VARCHAR(15) NOT NULL DEFAULT 'open',
        -- 'open','closed','exported'
    exported_at     TIMESTAMPTZ,
    exported_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, book_type, period_year, period_month)
);

CREATE TABLE tax_book_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id         UUID NOT NULL REFERENCES tax_books(id),
    entry_date      DATE NOT NULL,
    document_type   VARCHAR(30) NOT NULL,       -- 'invoice','credit_note','debit_note'
    document_number VARCHAR(50) NOT NULL,
    counterpart_rif VARCHAR(20),
    counterpart_name VARCHAR(200),
    control_number  VARCHAR(20),
    total_bs        NUMERIC(18,4) NOT NULL,
    exempt_bs       NUMERIC(18,4) NOT NULL DEFAULT 0,
    taxable_base_general_bs NUMERIC(18,4) NOT NULL DEFAULT 0,
    iva_general_bs          NUMERIC(18,4) NOT NULL DEFAULT 0,
    taxable_base_reduced_bs NUMERIC(18,4) NOT NULL DEFAULT 0,
    iva_reduced_bs          NUMERIC(18,4) NOT NULL DEFAULT 0,
    igtf_bs                 NUMERIC(18,4) NOT NULL DEFAULT 0,
    withholding_iva_bs      NUMERIC(18,4) NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Libro Foliado de Psicotrópicos (SACS)
CREATE TABLE sacs_control_book (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    folio_number    VARCHAR(20) NOT NULL,
    entry_date      DATE NOT NULL,
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID NOT NULL REFERENCES inventory_lots(id),
    movement_type   VARCHAR(15) NOT NULL,   -- 'entry','sale','return','adjustment'
    quantity        NUMERIC(12,3) NOT NULL,
    balance_after   NUMERIC(12,3) NOT NULL,
    -- Si es venta
    dispensation_id UUID REFERENCES controlled_dispensations(id),
    patient_cedula  VARCHAR(20),
    prescriber_id   UUID REFERENCES prescribers(id),
    -- Si es entrada
    supplier_id     UUID REFERENCES suppliers(id),
    invoice_number  VARCHAR(50),
    notes           TEXT,
    registered_by   UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, folio_number)
);

-- ============================================================================
-- 17. AUDITORÍA INMUTABLE
-- ============================================================================

CREATE TABLE audit_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID NOT NULL,
    action          VARCHAR(10) NOT NULL,   -- 'INSERT','UPDATE','DELETE'
    old_values      JSONB,
    new_values      JSONB,
    changed_fields  TEXT[],
    justification   TEXT,                    -- Obligatorio para anulaciones/ajustes
    user_id         UUID NOT NULL REFERENCES users(id),
    terminal_id     UUID REFERENCES terminals(id),
    ip_address      INET,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_log_table ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at);

-- ============================================================================
-- 18. SINCRONIZACIÓN (SQLite ↔ PostgreSQL)
-- ============================================================================

CREATE TABLE sync_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id     UUID NOT NULL REFERENCES terminals(id),
    sync_direction  VARCHAR(10) NOT NULL,   -- 'upload','download'
    sync_type       VARCHAR(20) NOT NULL,   -- 'tickets','catalog','prices','config'
    records_synced  INTEGER NOT NULL DEFAULT 0,
    records_failed  INTEGER NOT NULL DEFAULT 0,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    status          VARCHAR(15) NOT NULL DEFAULT 'in_progress',
        -- 'in_progress','completed','failed','partial'
    error_details   JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sync_log_terminal ON sync_log(terminal_id, created_at DESC);

CREATE TABLE sync_conflicts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sync_log_id     UUID NOT NULL REFERENCES sync_log(id),
    table_name      VARCHAR(100) NOT NULL,
    record_id       UUID NOT NULL,
    local_data      JSONB NOT NULL,
    cloud_data      JSONB NOT NULL,
    resolution      VARCHAR(20),   -- 'local_wins','cloud_wins','merged','manual'
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Alert: pérdida de sincronización > 24h
CREATE VIEW v_terminals_sync_alert AS
SELECT
    t.id, t.code, t.branch_id, t.last_sync_at,
    EXTRACT(EPOCH FROM (now() - t.last_sync_at)) / 3600 AS hours_since_sync,
    CASE
        WHEN t.last_sync_at IS NULL THEN 'NEVER_SYNCED'
        WHEN t.last_sync_at < now() - INTERVAL '24 hours' THEN 'CRITICAL'
        WHEN t.last_sync_at < now() - INTERVAL '12 hours' THEN 'WARNING'
        ELSE 'OK'
    END AS sync_status
FROM terminals t
WHERE t.is_active = TRUE;

-- ============================================================================
-- 19. BACKUPS
-- ============================================================================

CREATE TABLE backup_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID REFERENCES branches(id),
    backup_type     VARCHAR(15) NOT NULL,   -- 'local','cloud','full','incremental'
    backup_location TEXT NOT NULL,
    file_size_bytes BIGINT,
    started_at      TIMESTAMPTZ NOT NULL,
    completed_at    TIMESTAMPTZ,
    status          VARCHAR(15) NOT NULL DEFAULT 'in_progress',
    error_details   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 20. DASHBOARD / BI METRICS (Precalculadas)
-- ============================================================================

CREATE TABLE bi_dashboard_metrics (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    metric_date     DATE NOT NULL,
    metric_key      VARCHAR(50) NOT NULL,
        -- 'total_sales_usd','comparator_savings_usd','crm_return_pct',
        -- 'consignment_sales_usd','immobilized_capital_usd','avg_margin_pct'
    metric_value    NUMERIC(18,4) NOT NULL,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (branch_id, metric_date, metric_key)
);

-- ============================================================================
-- 21. TOMA DE INVENTARIO / AUDITORÍA FÍSICA (PRD 5.9)
-- ============================================================================

-- Orden de conteo (cabecera)
CREATE TABLE inventory_counts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    count_number    VARCHAR(30) NOT NULL UNIQUE,   -- 'INV-20260410-001'
    count_type      VARCHAR(20) NOT NULL,
        -- 'total' (muro a muro), 'partial' (categoría/ubicación), 'cyclic' (rotativo ABC)
    status          VARCHAR(20) NOT NULL DEFAULT 'draft',
        -- 'draft','in_progress','pending_review','approved','cancelled'

    -- Alcance del conteo
    scope_description TEXT,                        -- Descripción legible: "Pasillo 1, Estantes A-D"
    scope_category_id UUID REFERENCES categories(id),      -- Si parcial por categoría
    scope_location_ids UUID[],                              -- Si parcial por ubicaciones
    scope_abc_classes  CHAR(1)[],                           -- Si cíclico: {'A'} o {'A','B'}
    scope_risk_levels  VARCHAR(10)[],                       -- Si cíclico por riesgo: {'critical'}

    -- Bloqueo de inventario
    blocks_sales    BOOLEAN NOT NULL DEFAULT FALSE, -- TRUE = SKUs en alcance se marcan inventory_blocked
    blocked_at      TIMESTAMPTZ,
    unblocked_at    TIMESTAMPTZ,

    -- Métricas resumen (se calculan al conciliar)
    total_skus_expected     INTEGER,
    total_skus_counted      INTEGER,
    total_skus_matched      INTEGER,               -- Sin discrepancia
    total_skus_over         INTEGER,               -- Sobrantes
    total_skus_short        INTEGER,               -- Faltantes
    accuracy_pct            NUMERIC(5,2),           -- (matched / expected) × 100

    -- Workflow
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    notes           TEXT,

    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_counts_branch ON inventory_counts(branch_id, status);
CREATE INDEX idx_inventory_counts_status ON inventory_counts(status) WHERE status IN ('in_progress', 'pending_review');

-- Líneas de conteo (un registro por SKU/lote a contar)
CREATE TABLE inventory_count_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    count_id        UUID NOT NULL REFERENCES inventory_counts(id) ON DELETE CASCADE,
    product_id      UUID NOT NULL REFERENCES products(id),
    lot_id          UUID REFERENCES inventory_lots(id),       -- NULL si el producto no maneja lotes
    location_id     UUID REFERENCES warehouse_locations(id),

    -- Stock teórico (snapshot al iniciar el conteo)
    expected_quantity   NUMERIC(12,3) NOT NULL,
    expected_lot_number VARCHAR(50),
    expected_expiration_date DATE,

    -- Conteo físico
    counted_quantity    NUMERIC(12,3),                         -- NULL hasta que se cuente
    counted_lot_number  VARCHAR(50),                           -- Verificación de lote
    counted_expiration_date DATE,                              -- Verificación de vencimiento
    counted_expiry_signal   VARCHAR(10),                       -- Semáforo FEFO al momento del conteo

    -- Resultado de conciliación
    difference          NUMERIC(12,3),                         -- counted - expected (auto-calculado)
    difference_type     VARCHAR(10),                           -- 'match','over','short'
    adjustment_id       UUID,                                  -- FK a inventory adjustment generado (si aplica)

    -- Metadata del conteo
    counted_by      UUID REFERENCES users(id),
    counted_at      TIMESTAMPTZ,
    device_type     VARCHAR(20),                               -- 'mobile','pos_terminal','web'
    is_recounted    BOOLEAN NOT NULL DEFAULT FALSE,            -- TRUE si fue recontado
    recount_reason  TEXT,

    -- Sync offline
    is_synced       BOOLEAN NOT NULL DEFAULT TRUE,
    local_counted_at TIMESTAMPTZ,                              -- Timestamp del dispositivo offline

    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_count_items_count ON inventory_count_items(count_id);
CREATE INDEX idx_count_items_product ON inventory_count_items(product_id);
CREATE INDEX idx_count_items_diff ON inventory_count_items(difference_type) WHERE difference_type IN ('over', 'short');

-- Generación de órdenes de conteo cíclico (programación automática)
CREATE TABLE inventory_cyclic_schedules (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id       UUID NOT NULL REFERENCES branches(id),
    name            VARCHAR(100) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,

    -- Criterios de selección
    abc_classes     CHAR(1)[] NOT NULL,                -- {'A'} para solo clase A
    risk_levels     VARCHAR(10)[],                     -- {'critical','sensitive'} para riesgo
    frequency_days  SMALLINT NOT NULL DEFAULT 7,       -- Cada cuántos días generar

    -- Configuración
    max_skus_per_count  INTEGER NOT NULL DEFAULT 50,   -- SKUs por orden de conteo generada
    auto_generate       BOOLEAN NOT NULL DEFAULT TRUE,

    last_generated_at   TIMESTAMPTZ,
    next_generation_at  TIMESTAMPTZ,

    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Vista de precisión de inventario (para dashboard)
CREATE VIEW v_inventory_accuracy AS
SELECT
    ic.branch_id,
    ic.count_type,
    ic.count_number,
    ic.completed_at::DATE AS count_date,
    ic.accuracy_pct,
    ic.total_skus_expected,
    ic.total_skus_matched,
    ic.total_skus_over,
    ic.total_skus_short,
    COALESCE(SUM(ABS(ici.difference) * il.cost_usd), 0) AS total_variance_usd
FROM inventory_counts ic
LEFT JOIN inventory_count_items ici ON ici.count_id = ic.id AND ici.difference_type != 'match'
LEFT JOIN inventory_lots il ON il.id = ici.lot_id
WHERE ic.status = 'approved'
GROUP BY ic.id, ic.branch_id, ic.count_type, ic.count_number, ic.completed_at, ic.accuracy_pct,
         ic.total_skus_expected, ic.total_skus_matched, ic.total_skus_over, ic.total_skus_short;

-- ============================================================================
-- FIN DEL ESQUEMA
-- ============================================================================
```
