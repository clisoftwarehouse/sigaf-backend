import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateBrandDto, UpdateBrandDto } from './dto';
import { BrandEntity } from './infrastructure/persistence/relational/entities/brand.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandRepo: Repository<BrandEntity>,
  ) {}

  async findAll(query: { search?: string; isLaboratory?: boolean }): Promise<BrandEntity[]> {
    const qb = this.brandRepo.createQueryBuilder('b');

    if (query.search) {
      qb.andWhere('b.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isLaboratory !== undefined) {
      qb.andWhere('b.isLaboratory = :isLaboratory', { isLaboratory: query.isLaboratory });
    }

    return qb.orderBy('b.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<BrandEntity> {
    const brand = await this.brandRepo.findOne({ where: { id } });
    if (!brand) throw new NotFoundException('Marca no encontrada');
    return brand;
  }

  async create(dto: CreateBrandDto): Promise<BrandEntity> {
    const brand = this.brandRepo.create(dto);
    return this.brandRepo.save(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandEntity> {
    const brand = await this.findOne(id);
    Object.assign(brand, dto);
    return this.brandRepo.save(brand);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.brandRepo.delete(id);
    return { success: true };
  }
}
