import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { LabConditionEntity } from '../infrastructure/persistence/relational/entities/lab-condition.entity';
import { DrugstoreConditionEntity } from '../infrastructure/persistence/relational/entities/drugstore-condition.entity';
import {
  QueryLabConditionsDto,
  CreateLabConditionDto,
  UpdateLabConditionDto,
  QueryDrugstoreConditionsDto,
  CreateDrugstoreConditionDto,
  UpdateDrugstoreConditionDto,
} from '../dto';

/**
 * CRUD de condiciones comerciales (droguerías + laboratorios).
 *
 * El cálculo de costo neto que CONSUME estas condiciones vive en el engine
 * puro (`engine/net-cost.calculator.ts`). Este service solo administra el
 * dato — sin lógica de negocio mezclada.
 */
@Injectable()
export class ConditionsService {
  constructor(
    @InjectRepository(DrugstoreConditionEntity)
    private readonly drugstoreRepo: Repository<DrugstoreConditionEntity>,
    @InjectRepository(LabConditionEntity)
    private readonly labRepo: Repository<LabConditionEntity>,
  ) {}

  // ─── Drugstore conditions ──────────────────────────────────────────────

  async findAllDrugstore(query: QueryDrugstoreConditionsDto): Promise<DrugstoreConditionEntity[]> {
    const where: Record<string, unknown> = {};
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.productId) where.productId = query.productId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    return this.drugstoreRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneDrugstore(id: string): Promise<DrugstoreConditionEntity> {
    const condition = await this.drugstoreRepo.findOne({ where: { id } });
    if (!condition) throw new NotFoundException('Condición de droguería no encontrada');
    return condition;
  }

  async createDrugstore(dto: CreateDrugstoreConditionDto): Promise<DrugstoreConditionEntity> {
    this.validateDateRange(dto.validFrom, dto.validTo);
    const condition = this.drugstoreRepo.create({
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
    });
    return this.drugstoreRepo.save(condition);
  }

  async updateDrugstore(id: string, dto: UpdateDrugstoreConditionDto): Promise<DrugstoreConditionEntity> {
    const condition = await this.findOneDrugstore(id);
    this.validateDateRange(dto.validFrom, dto.validTo);
    Object.assign(condition, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : condition.validFrom,
      validTo: dto.validTo === undefined ? condition.validTo : dto.validTo ? new Date(dto.validTo) : null,
    });
    return this.drugstoreRepo.save(condition);
  }

  async removeDrugstore(id: string): Promise<{ success: boolean }> {
    const condition = await this.findOneDrugstore(id);
    condition.isActive = false;
    await this.drugstoreRepo.save(condition);
    return { success: true };
  }

  // ─── Lab conditions ────────────────────────────────────────────────────

  async findAllLab(query: QueryLabConditionsDto): Promise<LabConditionEntity[]> {
    const where: Record<string, unknown> = {};
    if (query.brandId) where.brandId = query.brandId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.productId) where.productId = query.productId;
    if (query.isActive !== undefined) where.isActive = query.isActive;
    return this.labRepo.find({ where, order: { createdAt: 'DESC' } });
  }

  async findOneLab(id: string): Promise<LabConditionEntity> {
    const condition = await this.labRepo.findOne({ where: { id } });
    if (!condition) throw new NotFoundException('Condición de laboratorio no encontrada');
    return condition;
  }

  async createLab(dto: CreateLabConditionDto): Promise<LabConditionEntity> {
    this.validateDateRange(dto.validFrom, dto.validTo);
    if (dto.escalaPct && dto.escalaPct > 0 && !dto.escalaMinUnits) {
      throw new BadRequestException(
        'Si configurás un descuento por escala, debés indicar `escalaMinUnits` (cantidad mínima).',
      );
    }
    const condition = this.labRepo.create({
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
      validTo: dto.validTo ? new Date(dto.validTo) : null,
    });
    return this.labRepo.save(condition);
  }

  async updateLab(id: string, dto: UpdateLabConditionDto): Promise<LabConditionEntity> {
    const condition = await this.findOneLab(id);
    this.validateDateRange(dto.validFrom, dto.validTo);
    Object.assign(condition, {
      ...dto,
      validFrom: dto.validFrom ? new Date(dto.validFrom) : condition.validFrom,
      validTo: dto.validTo === undefined ? condition.validTo : dto.validTo ? new Date(dto.validTo) : null,
    });
    return this.labRepo.save(condition);
  }

  async removeLab(id: string): Promise<{ success: boolean }> {
    const condition = await this.findOneLab(id);
    condition.isActive = false;
    await this.labRepo.save(condition);
    return { success: true };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private validateDateRange(from?: string, to?: string): void {
    if (!from || !to) return;
    if (new Date(to).getTime() < new Date(from).getTime()) {
      throw new BadRequestException('`validTo` no puede ser anterior a `validFrom`.');
    }
  }
}
