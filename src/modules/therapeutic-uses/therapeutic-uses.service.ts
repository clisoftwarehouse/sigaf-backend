import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateTherapeuticUseDto, UpdateTherapeuticUseDto } from './dto';
import { TherapeuticUseEntity } from './infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';

@Injectable()
export class TherapeuticUsesService {
  constructor(
    @InjectRepository(TherapeuticUseEntity)
    private readonly repo: Repository<TherapeuticUseEntity>,
    @InjectRepository(ActiveIngredientEntity)
    private readonly activeIngredientRepo: Repository<ActiveIngredientEntity>,
  ) {}

  async findAll(query: { search?: string; atcCode?: string }): Promise<TherapeuticUseEntity[]> {
    const qb = this.repo.createQueryBuilder('tu');

    if (query.search) {
      qb.andWhere('tu.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.atcCode) {
      qb.andWhere('tu.atc_code ILIKE :atc', { atc: `${query.atcCode}%` });
    }

    return qb.orderBy('tu.name', 'ASC').getMany();
  }

  async findOne(id: string): Promise<TherapeuticUseEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Acción terapéutica no encontrada');
    return item;
  }

  async create(dto: CreateTherapeuticUseDto): Promise<TherapeuticUseEntity> {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException('Ya existe una acción terapéutica con ese nombre');

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
    const linkedIngredients = await this.activeIngredientRepo.count({
      where: { therapeuticUseId: id },
    });
    if (linkedIngredients > 0) {
      throw new ConflictException(
        `No se puede eliminar esta acción terapéutica porque está asignada a ${linkedIngredients} principio(s) activo(s). ` +
          `Reasígnalos primero a otra acción terapéutica.`,
      );
    }
    await this.repo.delete(id);
    return { success: true };
  }
}
