import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { QueryLocationDto, CreateLocationDto, UpdateLocationDto } from './dto';
import { WarehouseLocationEntity } from '../inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(WarehouseLocationEntity)
    private readonly locationRepo: Repository<WarehouseLocationEntity>,
  ) {}

  async findAll(query: QueryLocationDto): Promise<WarehouseLocationEntity[]> {
    const where: Record<string, unknown> = { isActive: true };

    if (query.branchId) where.branchId = query.branchId;
    if (query.isQuarantine !== undefined) where.isQuarantine = query.isQuarantine;

    return this.locationRepo.find({ where });
  }

  async findOne(id: string): Promise<WarehouseLocationEntity> {
    const location = await this.locationRepo.findOne({ where: { id } });
    if (!location) throw new NotFoundException('Ubicación no encontrada');
    return location;
  }

  async create(dto: CreateLocationDto): Promise<WarehouseLocationEntity> {
    const location = this.locationRepo.create(dto);
    return this.locationRepo.save(location);
  }

  async update(id: string, dto: UpdateLocationDto): Promise<WarehouseLocationEntity> {
    const location = await this.findOne(id);
    Object.assign(location, dto);
    return this.locationRepo.save(location);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.locationRepo.update(id, { isActive: false });
    return { success: true };
  }
}
