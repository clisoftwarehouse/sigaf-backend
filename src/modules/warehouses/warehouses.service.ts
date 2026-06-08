import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { QueryWarehouseDto, CreateWarehouseDto, UpdateWarehouseDto } from './dto';
import { WarehouseLocationEntity } from '../inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';

@Injectable()
export class WarehousesService {
  constructor(
    @InjectRepository(WarehouseLocationEntity)
    private readonly warehouseRepo: Repository<WarehouseLocationEntity>,
  ) {}

  async findAll(query: QueryWarehouseDto): Promise<WarehouseLocationEntity[]> {
    const where: Record<string, unknown> = { isActive: true };

    if (query.branchId) where.branchId = query.branchId;
    if (query.isQuarantine !== undefined) where.isQuarantine = query.isQuarantine;
    if (query.isForSale !== undefined) where.isForSale = query.isForSale;
    if (query.isForPurchase !== undefined) where.isForPurchase = query.isForPurchase;

    return this.warehouseRepo.find({ where });
  }

  async findOne(id: string): Promise<WarehouseLocationEntity> {
    const warehouse = await this.warehouseRepo.findOne({ where: { id } });
    if (!warehouse) throw new NotFoundException('Almacén no encontrado');
    return warehouse;
  }

  async create(dto: CreateWarehouseDto): Promise<WarehouseLocationEntity> {
    const warehouse = this.warehouseRepo.create(dto);
    return this.warehouseRepo.save(warehouse);
  }

  async update(id: string, dto: UpdateWarehouseDto): Promise<WarehouseLocationEntity> {
    const warehouse = await this.findOne(id);
    Object.assign(warehouse, dto);
    return this.warehouseRepo.save(warehouse);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.warehouseRepo.update(id, { isActive: false });
    return { success: true };
  }
}
