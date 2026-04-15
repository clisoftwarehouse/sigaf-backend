import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateTherapeuticUseDto, UpdateTherapeuticUseDto } from './dto';
import { TherapeuticUseEntity } from './infrastructure/persistence/relational/entities/therapeutic-use.entity';

@Injectable()
export class TherapeuticUsesService {
  constructor(
    @InjectRepository(TherapeuticUseEntity)
    private readonly repo: Repository<TherapeuticUseEntity>,
  ) {}

  async findAll(query: { search?: string }): Promise<TherapeuticUseEntity[]> {
    const qb = this.repo.createQueryBuilder('tu');

    if (query.search) {
      qb.andWhere('tu.name ILIKE :search', { search: `%${query.search}%` });
    }

    return qb.orderBy('tu.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<TherapeuticUseEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Uso terapéutico no encontrado');
    return item;
  }

  async create(dto: CreateTherapeuticUseDto): Promise<TherapeuticUseEntity> {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Ya existe un uso terapéutico con ese nombre');

    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateTherapeuticUseDto): Promise<TherapeuticUseEntity> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.repo.delete(id);
    return { success: true };
  }
}
