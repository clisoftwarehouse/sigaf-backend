import { InjectDataSource } from '@nestjs/typeorm';
import { ILike, DataSource, EntityManager } from 'typeorm';
import { Injectable, BadRequestException } from '@nestjs/common';

import { SheetParser } from './parsers/sheet-parser';
import { ImportErrorDto, ImportResultDto } from './dto/import-result.dto';
import { BrandEntity } from '@/modules/brands/infrastructure/persistence/relational/entities/brand.entity';
import { PriceEntity } from '@/modules/prices/infrastructure/persistence/relational/entities/price.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { CategoryEntity } from '@/modules/categories/infrastructure/persistence/relational/entities/category.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductBarcodeEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-barcode.entity';

export type ImportType = 'products' | 'stock-initial' | 'prices';

/**
 * Orquesta importación masiva CSV/XLSX de entidades del sistema.
 *
 * Estrategia de transaccionalidad:
 *   - Cada fila se procesa en su PROPIA transacción (QueryRunner), de modo que:
 *     • Los errores de una fila no contaminan a las siguientes.
 *     • Violaciones de unique constraints se reportan limpiamente.
 *   - Si `dryRun=true`, cada transacción se revierte al final del procesamiento
 *     exitoso, permitiendo validar sin persistir.
 *
 * Las filas usan códigos naturales (ean, branch_name, category_code) en vez de
 * UUIDs para que los templates sean editables sin conocimiento del schema.
 */
@Injectable()
export class ImportsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * Punto de entrada único. Parsea el archivo y delega al importer específico.
   */
  async import(
    type: ImportType,
    file: { buffer: Buffer; originalname: string } | undefined,
    dryRun: boolean,
    userId: string,
  ): Promise<ImportResultDto> {
    if (!file) throw new BadRequestException('Archivo requerido (multipart field: file)');

    const rows = SheetParser.parse(file.buffer, file.originalname);
    if (rows.length === 0) throw new BadRequestException('El archivo no contiene filas de datos');

    const result: ImportResultDto = {
      type,
      dryRun,
      total: rows.length,
      success: 0,
      failed: 0,
      created: 0,
      updated: 0,
      errors: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const rowNumber = i + 2; // +2 porque fila 1 es header y arrays son 0-indexed
      const row = rows[i];

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const outcome = await this.dispatchRow(type, row, queryRunner.manager, userId);

        if (dryRun) {
          await queryRunner.rollbackTransaction();
        } else {
          await queryRunner.commitTransaction();
        }

        result.success++;
        if (outcome === 'created') result.created++;
        else if (outcome === 'updated') result.updated++;
      } catch (err) {
        await queryRunner.rollbackTransaction();
        result.failed++;
        result.errors.push(this.buildError(rowNumber, err));
      } finally {
        await queryRunner.release();
      }
    }

    return result;
  }

  private async dispatchRow(
    type: ImportType,
    row: Record<string, string>,
    manager: EntityManager,
    userId: string,
  ): Promise<'created' | 'updated'> {
    switch (type) {
      case 'products':
        return this.importProductRow(row, manager);
      case 'stock-initial':
        return this.importStockInitialRow(row, manager);
      case 'prices':
        return this.importPriceRow(row, manager, userId);
      default:
        throw new BadRequestException(`Tipo de importación no soportado: ${type}`);
    }
  }

  // ─── PRODUCTS ─────────────────────────────────────────────────────────────

  /**
   * Upsert de producto. Clave natural: `ean` (preferente) o `internal_code`.
   * Si ambos vacíos → error. Si existe por clave, actualiza campos editables.
   * El barcode se registra en `product_barcodes` si viene `ean` y es nuevo.
   */
  private async importProductRow(row: Record<string, string>, manager: EntityManager): Promise<'created' | 'updated'> {
    const ean = SheetParser.toOptionalString(row.ean);
    const internalCode = SheetParser.toOptionalString(row.internal_code);
    if (!ean && !internalCode) {
      throw new Error('Debe proveer al menos `ean` o `internal_code`');
    }

    const description = SheetParser.toRequiredString(row.description, 'description');
    const categoryKey = SheetParser.toRequiredString(row.category_code_or_name, 'category_code_or_name');
    const category = await this.resolveCategory(categoryKey, manager);

    const brandName = SheetParser.toOptionalString(row.brand_name);
    const brand = brandName ? await this.resolveBrand(brandName, manager) : null;

    const productRepo = manager.getRepository(ProductEntity);
    const barcodeRepo = manager.getRepository(ProductBarcodeEntity);

    // Buscar existente
    let existing: ProductEntity | null = null;
    if (ean) existing = await productRepo.findOne({ where: { ean } });
    if (!existing && internalCode) existing = await productRepo.findOne({ where: { internalCode } });

    const productData: Partial<ProductEntity> = {
      ean: ean ?? existing?.ean ?? null,
      internalCode: internalCode ?? existing?.internalCode ?? null,
      description,
      shortName: SheetParser.toOptionalString(row.short_name),
      categoryId: category.id,
      brandId: brand?.id ?? null,
      productType: SheetParser.toOptionalString(row.product_type) ?? 'general',
      isControlled: SheetParser.toBoolean(row.is_controlled, false),
      requiresRecipe: SheetParser.toBoolean(row.requires_recipe, false),
      isAntibiotic: SheetParser.toBoolean(row.is_antibiotic, false),
      isWeighable: SheetParser.toBoolean(row.is_weighable, false),
      unitOfMeasure: SheetParser.toOptionalString(row.unit_of_measure) ?? 'UND',
      taxType: SheetParser.toOptionalString(row.tax_type) ?? 'exempt',
      pmvp: SheetParser.toNumber(row.pmvp, 'pmvp', false),
      stockMin: SheetParser.toNumber(row.stock_min, 'stock_min', false) ?? 0,
      isActive: SheetParser.toBoolean(row.is_active, true),
    };

    if (productData.productType === 'controlled') {
      productData.isControlled = true;
      productData.requiresRecipe = true;
    }
    if (productData.isWeighable) {
      productData.decimalPlaces = 3;
      if (!productData.unitOfMeasure || productData.unitOfMeasure === 'UND') {
        productData.unitOfMeasure = 'KG';
      }
    }

    let productId: string;
    let outcome: 'created' | 'updated';

    if (existing) {
      Object.assign(existing, productData);
      await productRepo.save(existing);
      productId = existing.id;
      outcome = 'updated';
    } else {
      // Generar internal_code si falta (usa secuencia postgres)
      if (!productData.internalCode) {
        const seq = (await manager.query("SELECT nextval('products_internal_code_seq') AS n")) as { n: string }[];
        const n = Number(seq[0]?.n ?? '1');
        productData.internalCode = `PROD-${String(n).padStart(6, '0')}`;
      }
      const created = await productRepo.save(productRepo.create(productData));
      productId = created.id;
      outcome = 'created';
    }

    // Registrar barcode si se trata de un EAN nuevo
    if (ean) {
      const existingBc = await barcodeRepo.findOne({ where: { barcode: ean } });
      if (!existingBc) {
        await barcodeRepo.save(
          barcodeRepo.create({
            productId,
            barcode: ean,
            barcodeType: 'ean13',
            isPrimary: true,
          }),
        );
      } else if (existingBc.productId !== productId) {
        throw new Error(`Código de barras '${ean}' ya pertenece a otro producto`);
      }
    }

    return outcome;
  }

  // ─── STOCK INICIAL ────────────────────────────────────────────────────────

  /**
   * Crea un lote de inventario para stock inicial.
   * No es un upsert: si el (product, branch, lot_number) ya existe, falla.
   * Para ajustes de stock existente, usar el endpoint de ajustes del módulo de inventario.
   */
  private async importStockInitialRow(row: Record<string, string>, manager: EntityManager): Promise<'created'> {
    const ean = SheetParser.toRequiredString(row.product_ean, 'product_ean');
    const branchName = SheetParser.toRequiredString(row.branch_name, 'branch_name');
    const lotNumber = SheetParser.toRequiredString(row.lot_number, 'lot_number');

    const product = await this.resolveProductByEan(ean, manager);
    const branch = await this.resolveBranch(branchName, manager);

    const expirationDate = SheetParser.toDateString(row.expiration_date, 'expiration_date', true);
    const manufactureDate = SheetParser.toDateString(row.manufacture_date, 'manufacture_date', false);
    const acquisitionType = SheetParser.toOptionalString(row.acquisition_type) ?? 'purchase';
    const costUsd = SheetParser.toNumber(row.cost_usd, 'cost_usd') as number;
    const salePrice = SheetParser.toNumber(row.sale_price, 'sale_price') as number;
    const quantityReceived = SheetParser.toNumber(row.quantity_received, 'quantity_received') as number;

    const lotRepo = manager.getRepository(InventoryLotEntity);

    const duplicate = await lotRepo.findOne({
      where: { productId: product.id, branchId: branch.id, lotNumber },
    });
    if (duplicate) {
      throw new Error(`Lote '${lotNumber}' ya existe para este producto en '${branchName}'`);
    }

    const marginPct = salePrice > 0 && costUsd > 0 ? ((salePrice - costUsd) / costUsd) * 100 : null;

    await lotRepo.save(
      lotRepo.create({
        productId: product.id,
        branchId: branch.id,
        lotNumber,
        expirationDate: new Date(expirationDate as string),
        manufactureDate: manufactureDate ? new Date(manufactureDate) : null,
        acquisitionType,
        costUsd,
        salePrice,
        marginPct,
        quantityReceived,
        quantityAvailable: quantityReceived,
        quantityReserved: 0,
        status: 'available',
      }),
    );

    return 'created';
  }

  // ─── PRICES ───────────────────────────────────────────────────────────────

  /**
   * Crea un precio USD (global o por sucursal). Cierra la vigencia abierta
   * anterior del mismo scope, replicando la lógica de PricesService.create.
   */
  private async importPriceRow(
    row: Record<string, string>,
    manager: EntityManager,
    userId: string,
  ): Promise<'created'> {
    const ean = SheetParser.toRequiredString(row.product_ean, 'product_ean');
    const product = await this.resolveProductByEan(ean, manager);

    const branchName = SheetParser.toOptionalString(row.branch_name);
    const branch = branchName ? await this.resolveBranch(branchName, manager) : null;

    const priceUsd = SheetParser.toNumber(row.price_usd, 'price_usd') as number;
    const effectiveFromStr = SheetParser.toDateString(row.effective_from, 'effective_from', true) as string;
    const effectiveFrom = new Date(effectiveFromStr);
    const effectiveToStr = SheetParser.toDateString(row.effective_to, 'effective_to', false);
    const effectiveTo = effectiveToStr ? new Date(effectiveToStr) : null;
    const notes = SheetParser.toOptionalString(row.notes);

    // Cerrar vigencia abierta del mismo scope
    await manager
      .createQueryBuilder()
      .update(PriceEntity)
      .set({ effectiveTo: effectiveFrom, updatedAt: new Date() })
      .where('product_id = :productId', { productId: product.id })
      .andWhere(branch ? 'branch_id = :branchId' : 'branch_id IS NULL', { branchId: branch?.id })
      .andWhere('effective_to IS NULL')
      .execute();

    const priceRepo = manager.getRepository(PriceEntity);
    await priceRepo.save(
      priceRepo.create({
        productId: product.id,
        branchId: branch?.id ?? null,
        priceUsd,
        effectiveFrom,
        effectiveTo,
        notes,
        createdBy: userId,
      }),
    );

    return 'created';
  }

  // ─── RESOLVERS DE FK ──────────────────────────────────────────────────────

  private async resolveCategory(key: string, manager: EntityManager): Promise<CategoryEntity> {
    const repo = manager.getRepository(CategoryEntity);
    // Prioridad: match exacto por code, luego por name (case-insensitive)
    const byCode = await repo.findOne({ where: { code: key } });
    if (byCode) return byCode;
    const byName = await repo.findOne({ where: { name: ILike(key) } });
    if (byName) return byName;
    throw new Error(`Categoría '${key}' no encontrada (buscar por code o name)`);
  }

  private async resolveBrand(name: string, manager: EntityManager): Promise<BrandEntity> {
    const repo = manager.getRepository(BrandEntity);
    const existing = await repo.findOne({ where: { name: ILike(name) } });
    if (existing) return existing;
    // Auto-crear marca si no existe (conveniencia para importación masiva)
    const created = repo.create({ name, isActive: true } as Partial<BrandEntity>);
    return repo.save(created);
  }

  private async resolveBranch(name: string, manager: EntityManager): Promise<BranchEntity> {
    const repo = manager.getRepository(BranchEntity);
    const existing = await repo.findOne({ where: { name: ILike(name) } });
    if (!existing) throw new Error(`Sucursal '${name}' no encontrada (debe existir previamente)`);
    return existing;
  }

  private async resolveProductByEan(ean: string, manager: EntityManager): Promise<ProductEntity> {
    const productRepo = manager.getRepository(ProductEntity);
    let product = await productRepo.findOne({ where: { ean } });
    if (product) return product;
    // Fallback: buscar por tabla de barcodes (ean puede estar en product_barcodes)
    const barcodeRepo = manager.getRepository(ProductBarcodeEntity);
    const bc = await barcodeRepo.findOne({ where: { barcode: ean } });
    if (bc) {
      product = await productRepo.findOne({ where: { id: bc.productId } });
      if (product) return product;
    }
    throw new Error(`Producto con EAN '${ean}' no encontrado`);
  }

  // ─── HELPERS ──────────────────────────────────────────────────────────────

  private buildError(rowNumber: number, err: unknown): ImportErrorDto {
    const message = err instanceof Error ? err.message : String(err);
    return { row: rowNumber, message };
  }
}
