import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateActiveIngredientDto, UpdateActiveIngredientDto } from './dto';
import { VademecumCandidate, VademecumScraperService } from './vademecum-scraper.service';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';

@Injectable()
export class ActiveIngredientsService {
  constructor(
    @InjectRepository(ActiveIngredientEntity)
    private readonly repo: Repository<ActiveIngredientEntity>,
    private readonly vademecum: VademecumScraperService,
  ) {}

  async findAll(query: { search?: string; atcCode?: string }): Promise<ActiveIngredientEntity[]> {
    const qb = this.repo.createQueryBuilder('ai');

    if (query.search) {
      qb.andWhere('(ai.name ILIKE :search OR ai.inn_name ILIKE :search)', { search: `%${query.search}%` });
    }
    if (query.atcCode) {
      qb.andWhere('ai.atc_code ILIKE :atc', { atc: `${query.atcCode}%` });
    }

    return qb.orderBy('ai.name', 'ASC').getMany();
  }

  /**
   * Busca candidatos en vademecum.es para obtener codificación ATC/INN.
   * No persiste nada: retorna la lista para que el cliente elija y llame
   * a `POST /active-ingredients` con los campos copiados.
   */
  lookupVademecum(q: string, limit = 10): Promise<VademecumCandidate[]> {
    return this.vademecum.search(q, limit);
  }

  /** Helper de debugging: devuelve HTML crudo de vademecum para ajustar parser. */
  debugVademecum(q: string): Promise<{ url: string; status: 'ok' | 'failed'; sample: string }> {
    return this.vademecum.debugFetch(q);
  }

  /**
   * Devuelve el candidato + jerarquía ATC (niveles 1-4) + grupo terapéutico
   * derivado (nombre del nivel 4) para que el frontend muestre un preview
   * antes de confirmar el import.
   */
  async fetchVademecumDetails(
    q: string,
    index = 0,
  ): Promise<{
    candidate: VademecumCandidate;
    atcHierarchy: Array<{ atcCode: string; name: string; level: 1 | 2 | 3 | 4; url: string }>;
    therapeuticGroup: string | null;
  }> {
    const candidates = await this.vademecum.search(q, index + 1);
    const candidate = candidates[index];
    if (!candidate) {
      throw new NotFoundException(`No se encontraron candidatos en vademecum para "${q}"`);
    }
    const atcHierarchy = await this.vademecum.fetchAtcHierarchy(candidate.name);
    const therapeuticGroup =
      atcHierarchy.find((l) => l.level === 4)?.name ?? atcHierarchy.find((l) => l.level === 3)?.name ?? null;
    return { candidate, atcHierarchy, therapeuticGroup };
  }

  /**
   * Busca en vademecum.es y persiste el candidato indicado (por defecto el primero).
   * Trae adicionalmente la jerarquía ATC para poblar `therapeuticGroup` con el
   * nombre del nivel 4 (o 3 si no existe 4). Idempotente: si ya existe un
   * registro con el mismo `atc_code` o `name`, lo actualiza con los datos
   * traídos de vademecum; si no, crea uno nuevo.
   */
  async importFromVademecum(q: string, index = 0): Promise<ActiveIngredientEntity> {
    const { candidate, therapeuticGroup } = await this.fetchVademecumDetails(q, index);

    // Buscar existente por atc_code (preferido) o por nombre exacto.
    let existing: ActiveIngredientEntity | null = null;
    if (candidate.atcCode) {
      existing = await this.repo.findOne({ where: { atcCode: candidate.atcCode } });
    }
    if (!existing) {
      existing = await this.repo.findOne({ where: { name: candidate.name } });
    }

    if (existing) {
      existing.name = candidate.name;
      existing.atcCode = candidate.atcCode;
      // Poblamos therapeuticGroup si estaba vacío, respetando el valor manual.
      if (!existing.therapeuticGroup && therapeuticGroup) {
        existing.therapeuticGroup = therapeuticGroup;
      }
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        name: candidate.name,
        atcCode: candidate.atcCode,
        therapeuticGroup: therapeuticGroup,
      }),
    );
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
