import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateActiveIngredientDto, UpdateActiveIngredientDto } from './dto';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';

@Injectable()
export class ActiveIngredientsService {
  constructor(
    @InjectRepository(ActiveIngredientEntity)
    private readonly repo: Repository<ActiveIngredientEntity>,
  ) {}

  async findAll(query: { search?: string }): Promise<ActiveIngredientEntity[]> {
    const qb = this.repo.createQueryBuilder('ai');

    if (query.search) {
      qb.andWhere('ai.name ILIKE :search', { search: `%${query.search}%` });
    }

    return qb.orderBy('ai.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<ActiveIngredientEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Principio activo no encontrado');
    return item;
  }

  async create(dto: CreateActiveIngredientDto): Promise<ActiveIngredientEntity> {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Ya existe un principio activo con ese nombre');

    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateActiveIngredientDto): Promise<ActiveIngredientEntity> {
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
