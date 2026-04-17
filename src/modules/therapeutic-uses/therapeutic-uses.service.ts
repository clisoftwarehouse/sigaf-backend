import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateTherapeuticUseDto, UpdateTherapeuticUseDto } from './dto';
import { VademecumAtcLevel, VademecumScraperService } from '../active-ingredients/vademecum-scraper.service';
import { TherapeuticUseEntity } from './infrastructure/persistence/relational/entities/therapeutic-use.entity';

@Injectable()
export class TherapeuticUsesService {
  constructor(
    @InjectRepository(TherapeuticUseEntity)
    private readonly repo: Repository<TherapeuticUseEntity>,
    private readonly vademecum: VademecumScraperService,
  ) {}

  async findAll(query: { search?: string; atcCode?: string }): Promise<TherapeuticUseEntity[]> {
    const qb = this.repo.createQueryBuilder('tu');

    if (query.search) {
      qb.andWhere('tu.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.atcCode) {
      qb.andWhere('tu.atc_code ILIKE :atc', { atc: `${query.atcCode}%` });
    }

    return qb.orderBy('tu.atc_code', 'ASC').addOrderBy('tu.name', 'ASC').getMany();
  }

  /**
   * Consulta vademecum.es y devuelve la jerarquía ATC completa (niveles 1-4)
   * del principio activo buscado. No persiste — devuelve los candidatos para
   * que el cliente los cree con `POST /therapeutic-uses`.
   */
  lookupVademecum(q: string): Promise<VademecumAtcLevel[]> {
    return this.vademecum.fetchAtcHierarchy(q);
  }

  /**
   * Importa (upsert) la jerarquía ATC completa de un principio activo desde
   * vademecum.es. Idempotente por `atc_code`: si el nivel ya existe se
   * actualiza el nombre, si no se crea. Retorna todos los registros tocados.
   */
  async importVademecumHierarchy(q: string): Promise<TherapeuticUseEntity[]> {
    const levels = await this.vademecum.fetchAtcHierarchy(q);
    if (levels.length === 0) return [];

    const persisted: TherapeuticUseEntity[] = [];
    for (const lvl of levels) {
      let entity = await this.repo.findOne({ where: { atcCode: lvl.atcCode } });
      if (entity) {
        entity.name = lvl.name;
      } else {
        // Si ya hay un uso con ese nombre (sin ATC), lo adopta en lugar de duplicar.
        entity = await this.repo.findOne({ where: { name: lvl.name } });
        if (entity) {
          entity.atcCode = lvl.atcCode;
        } else {
          entity = this.repo.create({ name: lvl.name, atcCode: lvl.atcCode });
        }
      }
      persisted.push(await this.repo.save(entity));
    }
    return persisted;
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
