import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { ProductEntity } from './infrastructure/persistence/relational/entities/product.entity';
import { AddBarcodeDto, QueryProductDto, AddIngredientDto, CreateProductDto, UpdateProductDto } from './dto';
import { ProductBarcodeEntity } from './infrastructure/persistence/relational/entities/product-barcode.entity';
import { ProductSubstituteEntity } from './infrastructure/persistence/relational/entities/product-substitute.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductActiveIngredientEntity } from './infrastructure/persistence/relational/entities/product-active-ingredient.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(ProductBarcodeEntity)
    private readonly barcodeRepo: Repository<ProductBarcodeEntity>,
    @InjectRepository(ProductActiveIngredientEntity)
    private readonly ingredientRepo: Repository<ProductActiveIngredientEntity>,
    @InjectRepository(ProductSubstituteEntity)
    private readonly substituteRepo: Repository<ProductSubstituteEntity>,
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    private readonly auditService: AuditService,
  ) {}

  // ─── LIST ──────────────────────────────────────────────────────────────
  async findAll(query: QueryProductDto): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.category', 'c')
      .leftJoinAndSelect('p.brand', 'b')
      .leftJoinAndSelect('p.barcodes', 'bc');

    if (query.search) {
      qb.andWhere(
        `(p.description ILIKE :search OR p.internal_code ILIKE :search
          OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode ILIKE :search))`,
        { search: `%${query.search}%` },
      );
    }
    if (query.categoryId) qb.andWhere('p.category_id = :categoryId', { categoryId: query.categoryId });
    if (query.brandId) qb.andWhere('p.brand_id = :brandId', { brandId: query.brandId });
    if (query.productType) qb.andWhere('p.product_type = :productType', { productType: query.productType });
    if (query.taxType) qb.andWhere('p.tax_type = :taxType', { taxType: query.taxType });

    if (query.isActive !== undefined) {
      qb.andWhere('p.is_active = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('p.is_active = true');
    }

    if (query.stockStatus) {
      const stockSub = `(SELECT COALESCE(SUM(sl.quantity_available), 0) FROM inventory_lots sl WHERE sl.product_id = p.id AND sl.status = 'available')`;
      if (query.stockStatus === 'out') {
        qb.andWhere(`${stockSub} = 0`);
      } else if (query.stockStatus === 'low') {
        qb.andWhere(`${stockSub} > 0 AND ${stockSub} <= p.stock_min`);
      } else if (query.stockStatus === 'normal') {
        qb.andWhere(`${stockSub} > p.stock_min`);
      }
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.description', 'ASC')
      .getManyAndCount();

    const productIds = data.map((p) => p.id);
    let stockMap: Record<string, number> = {};
    if (productIds.length) {
      const stocks = await this.lotRepo
        .createQueryBuilder('lot')
        .select('lot.product_id', 'productId')
        .addSelect('COALESCE(SUM(lot.quantity_available), 0)', 'totalStock')
        .where("lot.product_id IN (:...ids) AND lot.status = 'available'", { ids: productIds })
        .groupBy('lot.product_id')
        .getRawMany();
      stockMap = stocks.reduce(
        (acc, r) => {
          acc[r.productId] = parseFloat(r.totalStock) || 0;
          return acc;
        },
        {} as Record<string, number>,
      );
    }

    const enriched = data.map((p) => ({
      ...p,
      totalStock: stockMap[p.id] || 0,
    }));

    return { data: enriched, total, page, limit };
  }

  // ─── FIND ONE ──────────────────────────────────────────────────────────
  async findOne(id: string): Promise<any> {
    const product = await this.productRepo.findOne({
      where: { id },
      relations: [
        'category',
        'brand',
        'barcodes',
        'activeIngredients',
        'activeIngredients.activeIngredient',
        'substitutes',
        'substitutes.substitute',
      ],
    });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const totalStockRaw = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity_available), 0)', 'total')
      .where("lot.productId = :id AND lot.status = 'available'", { id })
      .getRawOne();

    return {
      ...product,
      totalStock: parseFloat(totalStockRaw?.total) || 0,
    };
  }

  // ─── CREATE ────────────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async create(dto: CreateProductDto, userId?: string): Promise<ProductEntity> {
    if (dto.productType === 'controlled') {
      dto.isControlled = true;
      dto.requiresRecipe = true;
    }
    if (dto.isWeighable) {
      dto.decimalPlaces = 3;
      dto.unitOfMeasure = dto.unitOfMeasure || 'KG';
    }

    if (dto.internalCode) {
      const existsCode = await this.productRepo.findOne({ where: { internalCode: dto.internalCode } });
      if (existsCode) throw new ConflictException('Código interno ya registrado');
    }

    if (dto.barcodes?.length) {
      for (const bc of dto.barcodes) {
        const exists = await this.barcodeRepo.findOne({ where: { barcode: bc.barcode } });
        if (exists) throw new ConflictException(`Código de barras '${bc.barcode}' ya registrado`);
      }
    }

    const { barcodes: barcodesDto, activeIngredients: ingredientsDto, ...productData } = dto;

    const product = this.productRepo.create(productData);
    const saved = await this.productRepo.save(product);

    if (barcodesDto?.length) {
      const barcodes = barcodesDto.map((bc) =>
        this.barcodeRepo.create({
          productId: saved.id,
          barcode: bc.barcode,
          barcodeType: bc.barcodeType || 'ean13',
          isPrimary: bc.isPrimary || false,
        }),
      );
      await this.barcodeRepo.save(barcodes);
    }

    if (ingredientsDto?.length) {
      const ingredients = ingredientsDto.map((ing) =>
        this.ingredientRepo.create({
          productId: saved.id,
          activeIngredientId: ing.activeIngredientId,
          concentration: ing.concentration || null,
          isPrimary: ing.isPrimary ?? true,
        }),
      );
      await this.ingredientRepo.save(ingredients);
    }

    return this.findOne(saved.id);
  }

  // ─── UPDATE ────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateProductDto, userId?: string): Promise<ProductEntity> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const oldValues = { ...product };
    Object.assign(product, dto);
    const updated = await this.productRepo.save(product);

    if (userId) {
      await this.auditService.log({
        tableName: 'products',
        recordId: id,
        action: 'UPDATE',
        oldValues,
        newValues: updated,
        userId,
      });
    }

    return this.findOne(id);
  }

  // ─── SOFT DELETE ───────────────────────────────────────────────────────
  async remove(id: string, userId?: string): Promise<{ success: boolean }> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const stockResult = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantity_available), 0)', 'total')
      .where("lot.productId = :id AND lot.status = 'available'", { id })
      .getRawOne();

    const totalStock = parseFloat(stockResult?.total) || 0;
    if (totalStock > 0) {
      throw new ConflictException('No se puede eliminar un producto con stock disponible');
    }

    await this.productRepo.update(id, { isActive: false });

    if (userId) {
      await this.auditService.log({
        tableName: 'products',
        recordId: id,
        action: 'DELETE',
        userId,
        justification: 'Soft delete',
      });
    }

    return { success: true };
  }

  // ─── SEARCH ────────────────────────────────────────────────────────────
  async search(q: string, type?: string): Promise<ProductEntity[]> {
    if (!q || q.trim().length === 0) throw new BadRequestException('Parámetro de búsqueda requerido');

    const qb = this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.barcodes', 'bc')
      .where('p.is_active = true');

    if (type === 'ean') {
      qb.andWhere('EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode = :q)', { q });
    } else if (type === 'name') {
      qb.andWhere('p.description ILIKE :q', { q: `%${q}%` });
    } else if (type === 'ingredient') {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM product_active_ingredients pai
          JOIN active_ingredients ai ON ai.id = pai.active_ingredient_id
          WHERE pai.product_id = p.id AND ai.name ILIKE :q)`,
        { q: `%${q}%` },
      );
    } else {
      qb.andWhere(
        `(p.description ILIKE :q OR p.internal_code ILIKE :q
          OR EXISTS (SELECT 1 FROM product_barcodes pb WHERE pb.product_id = p.id AND pb.barcode ILIKE :q)
          OR EXISTS (SELECT 1 FROM product_active_ingredients pai
            JOIN active_ingredients ai ON ai.id = pai.active_ingredient_id
            WHERE pai.product_id = p.id AND ai.name ILIKE :q))`,
        { q: `%${q}%` },
      );
    }

    return qb.take(50).getMany();
  }

  // ─── INGREDIENTS ───────────────────────────────────────────────────────
  async addIngredient(productId: string, dto: AddIngredientDto): Promise<ProductActiveIngredientEntity> {
    await this.ensureProductExists(productId);

    const exists = await this.ingredientRepo.findOne({
      where: { productId, activeIngredientId: dto.activeIngredientId },
    });
    if (exists) throw new ConflictException('Principio activo ya asignado a este producto');

    const ingredient = this.ingredientRepo.create({
      productId,
      activeIngredientId: dto.activeIngredientId,
      concentration: dto.concentration || null,
      isPrimary: dto.isPrimary ?? true,
    });
    return this.ingredientRepo.save(ingredient);
  }

  async removeIngredient(productId: string, activeIngredientId: string): Promise<{ success: boolean }> {
    const ingredient = await this.ingredientRepo.findOne({
      where: { productId, activeIngredientId },
    });
    if (!ingredient) throw new NotFoundException('Principio activo no asignado a este producto');
    await this.ingredientRepo.remove(ingredient);
    return { success: true };
  }

  // ─── BARCODES ──────────────────────────────────────────────────────────
  async addBarcode(productId: string, dto: AddBarcodeDto): Promise<ProductBarcodeEntity> {
    await this.ensureProductExists(productId);

    const exists = await this.barcodeRepo.findOne({ where: { barcode: dto.barcode } });
    if (exists) throw new ConflictException(`Código de barras '${dto.barcode}' ya registrado`);

    const barcode = this.barcodeRepo.create({
      productId,
      barcode: dto.barcode,
      barcodeType: dto.barcodeType || 'ean13',
      isPrimary: dto.isPrimary || false,
    });
    return this.barcodeRepo.save(barcode);
  }

  async removeBarcode(productId: string, barcodeId: string): Promise<{ success: boolean }> {
    const barcode = await this.barcodeRepo.findOne({ where: { id: barcodeId, productId } });
    if (!barcode) throw new NotFoundException('Código de barras no encontrado para este producto');
    await this.barcodeRepo.remove(barcode);
    return { success: true };
  }

  async getProductBarcodes(productId: string): Promise<ProductBarcodeEntity[]> {
    await this.ensureProductExists(productId);
    return this.barcodeRepo.find({ where: { productId }, order: { isPrimary: 'DESC', createdAt: 'ASC' } });
  }

  // ─── SUBSTITUTES ──────────────────────────────────────────────────────
  async getSubstitutes(productId: string): Promise<any[]> {
    await this.ensureProductExists(productId);

    const ingredients = await this.ingredientRepo.find({ where: { productId } });
    if (!ingredients.length) return [];

    const ingredientIds = ingredients.map((i) => i.activeIngredientId);

    const substitutes = await this.productRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.barcodes', 'bc')
      .innerJoin('product_active_ingredients', 'pai', 'pai.product_id = p.id')
      .where('pai.active_ingredient_id IN (:...ingredientIds)', { ingredientIds })
      .andWhere('p.id != :productId', { productId })
      .andWhere('p.is_active = true')
      .getMany();

    const uniqueIds = [...new Set(substitutes.map((s) => s.id))];
    if (!uniqueIds.length) return [];

    const stocks = await this.lotRepo
      .createQueryBuilder('lot')
      .select('lot.product_id', 'productId')
      .addSelect('COALESCE(SUM(lot.quantity_available), 0)', 'totalStock')
      .where("lot.product_id IN (:...ids) AND lot.status = 'available'", { ids: uniqueIds })
      .groupBy('lot.product_id')
      .getRawMany();

    const stockMap = stocks.reduce(
      (acc, r) => {
        acc[r.productId] = parseFloat(r.totalStock) || 0;
        return acc;
      },
      {} as Record<string, number>,
    );

    const uniqueProducts = uniqueIds.map((uid) => substitutes.find((s) => s.id === uid)!);

    return uniqueProducts
      .map((p) => ({
        id: p.id,
        description: p.description,
        barcodes: p.barcodes,
        totalStock: stockMap[p.id] || 0,
      }))
      .filter((p) => p.totalStock > 0)
      .sort((a, b) => b.totalStock - a.totalStock);
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────
  private async ensureProductExists(id: string): Promise<void> {
    const exists = await this.productRepo.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Producto no encontrado');
  }
}
