import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { CreateBrandDto, UpdateBrandDto } from './dto';
import { BrandEntity } from './infrastructure/persistence/relational/entities/brand.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandRepo: Repository<BrandEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async findAll(query: { search?: string; isLaboratory?: boolean; isActive?: boolean }): Promise<BrandEntity[]> {
    const qb = this.brandRepo.createQueryBuilder('b');

    if (query.search) {
      qb.andWhere('b.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isLaboratory !== undefined) {
      qb.andWhere('b.isLaboratory = :isLaboratory', { isLaboratory: query.isLaboratory });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('b.isActive = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('b.isActive = true');
    }

    return qb.orderBy('b.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<BrandEntity> {
    const brand = await this.brandRepo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  async create(dto: CreateBrandDto): Promise<BrandEntity> {
    const existing = await this.brandRepo.findOne({ where: { name: dto.name } });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException('El nombre de la marca ya existe');
      }
      Object.assign(existing, dto, { isActive: true });
      return this.brandRepo.save(existing);
    }
    const brand = this.brandRepo.create(dto);
    try {
      return await this.brandRepo.save(brand);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandEntity> {
    const brand = await this.findOne(id);
    Object.assign(brand, dto);
    try {
      return await this.brandRepo.save(brand);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    const linkedCount = await this.productRepo.count({ where: { brandId: id, isActive: true } });
    if (linkedCount > 0) {
      throw new ConflictException(
        `No se puede inactivar la marca: ${linkedCount} producto(s) activo(s) la referencian`,
      );
    }
    await this.brandRepo.update(id, { isActive: false });
    return { success: true };
  }

  async restore(id: string): Promise<BrandEntity> {
    const brand = await this.findOne(id);
    if (brand.isActive) return brand;
    brand.isActive = true;
    return this.brandRepo.save(brand);
  }

  private translateUniqueViolation(err: unknown): Error {
    const e = err as { code?: string; detail?: string };
    if (e?.code === '23505' && e.detail?.includes('name')) {
      return new ConflictException('El nombre de la marca ya existe');
    }
    return err as Error;
  }
}
