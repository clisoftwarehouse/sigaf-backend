import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { QueryProductDto, CreateProductDto, UpdateProductDto } from './dto';
import { ProductEntity } from './infrastructure/persistence/relational/entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async findAll(
    query: QueryProductDto,
  ): Promise<{ data: ProductEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.productRepo.createQueryBuilder('p');

    if (query.search) {
      qb.andWhere('(p.description ILIKE :search OR p.ean ILIKE :search OR p.internalCode ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.categoryId) {
      qb.andWhere('p.categoryId = :categoryId', { categoryId: query.categoryId });
    }
    if (query.brandId) {
      qb.andWhere('p.brandId = :brandId', { brandId: query.brandId });
    }
    if (query.productType) {
      qb.andWhere('p.productType = :productType', { productType: query.productType });
    }
    if (query.taxType) {
      qb.andWhere('p.taxType = :taxType', { taxType: query.taxType });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('p.isActive = true');
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.description', 'ASC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<ProductEntity> {
    const product = await this.productRepo.findOne({ where: { id } });
    if (!product) throw new NotFoundException('Producto no encontrado');
    return product;
  }

  async create(dto: CreateProductDto): Promise<ProductEntity> {
    if (dto.productType === 'controlled') {
      dto.isControlled = true;
      dto.requiresRecipe = true;
    }
    if (dto.isWeighable) {
      dto.decimalPlaces = 3;
      dto.unitOfMeasure = dto.unitOfMeasure || 'KG';
    }

    const product = this.productRepo.create(dto);
    return this.productRepo.save(product);
  }

  async update(id: string, dto: UpdateProductDto): Promise<ProductEntity> {
    const product = await this.findOne(id);
    Object.assign(product, dto);
    return this.productRepo.save(product);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.productRepo.update(id, { isActive: false });
    return { success: true };
  }

  async search(q: string, type?: string): Promise<ProductEntity[]> {
    const qb = this.productRepo.createQueryBuilder('p').where('p.isActive = true');

    if (type === 'ean') {
      qb.andWhere('p.ean = :q', { q });
    } else if (type === 'name') {
      qb.andWhere('p.description ILIKE :q', { q: `%${q}%` });
    } else {
      qb.andWhere('(p.description ILIKE :q OR p.ean ILIKE :q OR p.internalCode ILIKE :q)', { q: `%${q}%` });
    }

    return qb.take(50).getMany();
  }
}
