import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateCommercialTaxonomyDto } from './dto/create-commercial-taxonomy.dto';
import { CommercialLineEntity } from './infrastructure/persistence/relational/entities/commercial-line.entity';
import { CommercialVariantEntity } from './infrastructure/persistence/relational/entities/commercial-variant.entity';

/**
 * Service común para los dos catálogos comerciales (líneas y variantes).
 * Ambos comparten el mismo shape — solo cambia la tabla. Los métodos están
 * duplicados por catálogo para mantener tipos exactos en lugar de un
 * helper genérico que diluya el tipado.
 */
@Injectable()
export class CommercialTaxonomiesService {
  constructor(
    @InjectRepository(CommercialLineEntity)
    private readonly linesRepo: Repository<CommercialLineEntity>,
    @InjectRepository(CommercialVariantEntity)
    private readonly variantsRepo: Repository<CommercialVariantEntity>,
  ) {}

  // ─── Lines ─────────────────────────────────────────────────────────────

  findAllLines(): Promise<CommercialLineEntity[]> {
    return this.linesRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOneLine(id: string): Promise<CommercialLineEntity> {
    const line = await this.linesRepo.findOne({ where: { id } });
    if (!line) throw new NotFoundException('Línea comercial no encontrada');
    return line;
  }

  async createLine(dto: CreateCommercialTaxonomyDto): Promise<CommercialLineEntity> {
    const name = dto.name.trim();
    const existing = await this.linesRepo
      .createQueryBuilder('cl')
      .where('LOWER(cl.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) {
      throw new ConflictException(`Ya existe una línea comercial llamada "${existing.name}"`);
    }
    return this.linesRepo.save(this.linesRepo.create({ name }));
  }

  // ─── Variants ──────────────────────────────────────────────────────────

  findAllVariants(): Promise<CommercialVariantEntity[]> {
    return this.variantsRepo.find({ where: { isActive: true }, order: { name: 'ASC' } });
  }

  async findOneVariant(id: string): Promise<CommercialVariantEntity> {
    const variant = await this.variantsRepo.findOne({ where: { id } });
    if (!variant) throw new NotFoundException('Variante comercial no encontrada');
    return variant;
  }

  async createVariant(dto: CreateCommercialTaxonomyDto): Promise<CommercialVariantEntity> {
    const name = dto.name.trim();
    const existing = await this.variantsRepo
      .createQueryBuilder('cv')
      .where('LOWER(cv.name) = LOWER(:name)', { name })
      .getOne();
    if (existing) {
      throw new ConflictException(`Ya existe una variante comercial llamada "${existing.name}"`);
    }
    return this.variantsRepo.save(this.variantsRepo.create({ name }));
  }
}
