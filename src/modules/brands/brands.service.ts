import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { CreateBrandDto, UpdateBrandDto } from './dto';
import { BrandEntity } from './infrastructure/persistence/relational/entities/brand.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';

@Injectable()
export class BrandsService {
  constructor(
    @InjectRepository(BrandEntity)
    private readonly brandRepo: Repository<BrandEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
  ) {}

  async findAll(query: {
    search?: string;
    isLaboratory?: boolean;
    brandType?: string;
    isActive?: boolean;
  }): Promise<BrandEntity[]> {
    const qb = this.brandRepo.createQueryBuilder('b');

    if (query.search) {
      qb.andWhere('(b.name ILIKE :search OR b.businessName ILIKE :search OR b.rif ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.isLaboratory !== undefined) {
      qb.andWhere('b.isLaboratory = :isLaboratory', { isLaboratory: query.isLaboratory });
    }
    if (query.brandType) {
      qb.andWhere('b.brandType = :brandType', { brandType: query.brandType });
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
    await this.assertReferencesValid(dto);
    if (dto.rif) await this.assertRifAvailable(dto.rif);
    const brand = this.brandRepo.create(dto);
    try {
      return await this.brandRepo.save(brand);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandEntity> {
    const brand = await this.findOne(id);
    await this.assertReferencesValid(dto, id);
    if (dto.rif && dto.rif !== brand.rif) await this.assertRifAvailable(dto.rif);
    Object.assign(brand, dto);
    try {
      return await this.brandRepo.save(brand);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.brandRepo.update(id, { isActive: false });
    return { success: true };
  }

  private async assertReferencesValid(dto: Partial<CreateBrandDto>, currentId?: string): Promise<void> {
    if (dto.supplierId) {
      const supplier = await this.supplierRepo.findOne({ where: { id: dto.supplierId } });
      if (!supplier) throw new NotFoundException('Proveedor referenciado no existe');
    }
    if (dto.parentBrandId) {
      if (currentId && dto.parentBrandId === currentId) {
        throw new BadRequestException('Una marca no puede ser su propia marca matriz');
      }
      const parent = await this.brandRepo.findOne({ where: { id: dto.parentBrandId } });
      if (!parent) throw new NotFoundException('Marca matriz no existe');
    }
  }

  private async assertRifAvailable(rif: string): Promise<void> {
    const exists = await this.brandRepo.findOne({ where: { rif } });
    if (exists) throw new ConflictException('El RIF ya está registrado en otra marca');
  }

  private translateUniqueViolation(err: unknown): Error {
    const e = err as { code?: string; detail?: string };
    if (e?.code === '23505') {
      if (e.detail?.includes('rif')) return new ConflictException('El RIF ya está registrado');
      if (e.detail?.includes('name')) return new ConflictException('El nombre de la marca ya existe');
    }
    return err as Error;
  }
}
