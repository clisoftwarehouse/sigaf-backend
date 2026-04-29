import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateActiveIngredientDto, UpdateActiveIngredientDto } from './dto';
import { VademecumCandidate, VademecumScraperService } from './vademecum-scraper.service';
import { ActiveIngredientEntity } from './infrastructure/persistence/relational/entities/active-ingredient.entity';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ProductActiveIngredientEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-active-ingredient.entity';

@Injectable()
export class ActiveIngredientsService {
  constructor(
    @InjectRepository(ActiveIngredientEntity)
    private readonly repo: Repository<ActiveIngredientEntity>,
    @InjectRepository(TherapeuticUseEntity)
    private readonly therapeuticUseRepo: Repository<TherapeuticUseEntity>,
    @InjectRepository(ProductActiveIngredientEntity)
    private readonly productLinkRepo: Repository<ProductActiveIngredientEntity>,
    private readonly vademecum: VademecumScraperService,
  ) {}

  async findAll(query: { search?: string; atcCode?: string }): Promise<ActiveIngredientEntity[]> {
    const qb = this.repo.createQueryBuilder('ai').leftJoinAndSelect('ai.therapeuticUse', 'tu');

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
   * Devuelve el candidato + jerarquía ATC (niveles 1-4) + acción terapéutica
   * sugerida (match por prefijo ATC contra el catálogo `therapeutic_uses`)
   * para que el frontend muestre un preview antes de confirmar el import.
   */
  async fetchVademecumDetails(
    q: string,
    index = 0,
  ): Promise<{
    candidate: VademecumCandidate;
    atcHierarchy: Array<{ atcCode: string; name: string; level: 1 | 2 | 3 | 4; url: string }>;
    therapeuticUse: TherapeuticUseEntity | null;
  }> {
    const candidates = await this.vademecum.search(q, index + 1);
    const candidate = candidates[index];
    if (!candidate) {
      throw new NotFoundException(`No se encontraron candidatos en vademecum para "${q}"`);
    }
    const atcHierarchy = await this.vademecum.fetchAtcHierarchy(candidate.name);
    const therapeuticUse = await this.matchTherapeuticUseByAtc(candidate.atcCode);
    return { candidate, atcHierarchy, therapeuticUse };
  }

  /**
   * Busca en vademecum.es y persiste el candidato indicado (por defecto el primero).
   * Asigna la acción terapéutica haciendo match por prefijo ATC contra el catálogo
   * `therapeutic_uses` (auto-asignación). Idempotente: si ya existe un registro con
   * el mismo `atc_code` o `name`, lo actualiza con los datos traídos de vademecum;
   * si no, crea uno nuevo.
   */
  async importFromVademecum(q: string, index = 0): Promise<ActiveIngredientEntity> {
    const { candidate, therapeuticUse } = await this.fetchVademecumDetails(q, index);

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
      // Solo poblamos la acción terapéutica si estaba vacía, respetando la asignación manual.
      if (!existing.therapeuticUseId && therapeuticUse) {
        existing.therapeuticUseId = therapeuticUse.id;
      }
      return this.repo.save(existing);
    }

    return this.repo.save(
      this.repo.create({
        name: candidate.name,
        atcCode: candidate.atcCode,
        therapeuticUseId: therapeuticUse?.id ?? null,
      }),
    );
  }

  /**
   * Empareja un código ATC completo (ej. "C09CA01") contra el catálogo
   * `therapeutic_uses` por **prefijo más largo**. Ej: si en el catálogo hay un
   * registro con atc_code="C09" → "Antihipertensivo", se devuelve ese.
   * Útil para auto-asignar la acción terapéutica al importar desde Vademecum.
   */
  private async matchTherapeuticUseByAtc(atcCode: string | null): Promise<TherapeuticUseEntity | null> {
    if (!atcCode) return null;
    const code = atcCode.toUpperCase();
    const candidates = await this.therapeuticUseRepo
      .createQueryBuilder('tu')
      .where('tu.atc_code IS NOT NULL')
      .andWhere(":atc LIKE tu.atc_code || '%'", { atc: code })
      .orderBy('LENGTH(tu.atc_code)', 'DESC')
      .limit(1)
      .getOne();
    return candidates ?? null;
  }

  async findOne(id: string): Promise<ActiveIngredientEntity> {
    const item = await this.repo.findOne({ where: { id }, relations: ['therapeuticUse'] });
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
    const linkedProducts = await this.productLinkRepo.count({ where: { activeIngredientId: id } });
    if (linkedProducts > 0) {
      throw new ConflictException(
        `No se puede eliminar este principio activo porque está siendo usado por ${linkedProducts} producto(s). ` +
          `Quítalo primero de los productos que lo referencian.`,
      );
    }
    await this.repo.delete(id);
    return { success: true };
  }
}
