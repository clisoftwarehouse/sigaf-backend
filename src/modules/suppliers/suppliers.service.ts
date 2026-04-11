import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateSupplierDto, UpdateSupplierDto } from './dto';
import { SupplierEntity } from './infrastructure/persistence/relational/entities/supplier.entity';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
  ) {}

  async findAll(query: { search?: string; isDrugstore?: boolean; isActive?: boolean }): Promise<SupplierEntity[]> {
    const qb = this.supplierRepo.createQueryBuilder('s');

    if (query.search) {
      qb.andWhere('(s.businessName ILIKE :search OR s.tradeName ILIKE :search OR s.rif ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.isDrugstore !== undefined) {
      qb.andWhere('s.isDrugstore = :isDrugstore', { isDrugstore: query.isDrugstore });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('s.isActive = true');
    }

    return qb.orderBy('s.businessName', 'ASC').getMany();
  }

  async findOne(id: string): Promise<SupplierEntity> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<SupplierEntity> {
    const supplier = this.supplierRepo.create(dto);
    return this.supplierRepo.save(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierEntity> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.supplierRepo.update(id, { isActive: false });
    return { success: true };
  }
}
