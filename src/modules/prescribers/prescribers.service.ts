import { ILike, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreatePrescriberDto, QueryPrescribersDto, UpdatePrescriberDto } from './dto';
import { PrescriberEntity } from './infrastructure/persistence/relational/entities/prescriber.entity';

@Injectable()
export class PrescribersService {
  constructor(
    @InjectRepository(PrescriberEntity)
    private readonly repo: Repository<PrescriberEntity>,
  ) {}

  async findAll(query: QueryPrescribersDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));

    const qb = this.repo.createQueryBuilder('p');
    if (query.search) {
      qb.andWhere('(p.fullName ILIKE :s OR p.mppsNumber ILIKE :s OR p.nationalId ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.specialty) qb.andWhere('p.specialty ILIKE :sp', { sp: `%${query.specialty}%` });
    if (query.isActive !== undefined) qb.andWhere('p.isActive = :a', { a: query.isActive });

    qb.orderBy('p.fullName', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string): Promise<PrescriberEntity> {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Médico no encontrado');
    return p;
  }

  async create(dto: CreatePrescriberDto, userId: string): Promise<PrescriberEntity> {
    const entity = this.repo.create({ ...dto, createdBy: userId });
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdatePrescriberDto): Promise<PrescriberEntity> {
    const p = await this.findOne(id);
    Object.assign(p, dto);
    return this.repo.save(p);
  }

  async deactivate(id: string): Promise<{ success: boolean }> {
    const p = await this.findOne(id);
    p.isActive = false;
    await this.repo.save(p);
    return { success: true };
  }
}

// Suppress unused warning for ILike — kept exported for future queries.
void ILike;
