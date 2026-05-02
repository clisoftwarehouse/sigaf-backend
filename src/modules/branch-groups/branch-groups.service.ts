import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { BranchGroupEntity } from './infrastructure/persistence/relational/entities/branch-group.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import {
  SetAmountRulesDto,
  AssignBranchesDto,
  SetCategoryRulesDto,
  CreateBranchGroupDto,
  UpdateBranchGroupDto,
} from './dto';
import { BranchGroupAmountApprovalRuleEntity } from './infrastructure/persistence/relational/entities/branch-group-amount-approval-rule.entity';
import { BranchGroupCategoryApprovalRuleEntity } from './infrastructure/persistence/relational/entities/branch-group-category-approval-rule.entity';

@Injectable()
export class BranchGroupsService {
  constructor(
    @InjectRepository(BranchGroupEntity)
    private readonly repo: Repository<BranchGroupEntity>,
    @InjectRepository(BranchGroupAmountApprovalRuleEntity)
    private readonly amountRuleRepo: Repository<BranchGroupAmountApprovalRuleEntity>,
    @InjectRepository(BranchGroupCategoryApprovalRuleEntity)
    private readonly categoryRuleRepo: Repository<BranchGroupCategoryApprovalRuleEntity>,
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: { search?: string; isActive?: boolean }): Promise<any[]> {
    const qb = this.repo.createQueryBuilder('g');
    if (query.search) {
      qb.andWhere('g.name ILIKE :search', { search: `%${query.search}%` });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('g.is_active = :isActive', { isActive: query.isActive });
    }
    const groups = await qb.orderBy('g.name', 'ASC').getMany();

    // Enriquecemos con el conteo de sucursales asignadas para que el listado
    // del frontend muestre "N sucursales" sin tener que cargarlas todas.
    if (groups.length === 0) return [];
    const counts = await this.branchRepo
      .createQueryBuilder('b')
      .select('b.branch_group_id', 'branchGroupId')
      .addSelect('COUNT(*)::int', 'count')
      .where('b.branch_group_id IN (:...ids)', { ids: groups.map((g) => g.id) })
      .groupBy('b.branch_group_id')
      .getRawMany<{ branchGroupId: string; count: number }>();
    const countByGroup = new Map(counts.map((r) => [r.branchGroupId, r.count]));

    return groups.map((g) => ({ ...g, branchCount: countByGroup.get(g.id) ?? 0 }));
  }

  async findOne(id: string): Promise<any> {
    const group = await this.repo.findOne({
      where: { id },
      relations: ['amountRules', 'amountRules.role', 'categoryRules', 'categoryRules.role'],
    });
    if (!group) throw new NotFoundException('Grupo no encontrado');

    const branches = await this.branchRepo.find({
      where: { branchGroupId: id },
      order: { name: 'ASC' },
    });

    return { ...group, branches };
  }

  async create(dto: CreateBranchGroupDto): Promise<BranchGroupEntity> {
    const exists = await this.repo.findOne({ where: { name: dto.name } });
    if (exists) throw new ConflictException(`Ya existe un grupo llamado "${dto.name}"`);
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateBranchGroupDto): Promise<BranchGroupEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Grupo no encontrado');
    if (dto.name && dto.name !== item.name) {
      const dup = await this.repo.findOne({ where: { name: dto.name } });
      if (dup) throw new ConflictException(`Ya existe un grupo llamado "${dto.name}"`);
    }
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Grupo no encontrado');
    const linkedBranches = await this.branchRepo.count({ where: { branchGroupId: id } });
    if (linkedBranches > 0) {
      throw new ConflictException(
        `No se puede eliminar este grupo porque tiene ${linkedBranches} sucursal(es) asignada(s). ` +
          `Reasígnalas primero a otro grupo.`,
      );
    }
    await this.repo.delete(id);
    return { success: true };
  }

  // ─── Amount rules ──────────────────────────────────────────────────────
  async setAmountRules(branchGroupId: string, dto: SetAmountRulesDto): Promise<BranchGroupAmountApprovalRuleEntity[]> {
    await this.ensureGroupExists(branchGroupId);

    // Validamos que los rangos no se solapen para evitar ambigüedad: si dos
    // roles cubren el mismo monto el motor de aprobación tendría que elegir
    // arbitrariamente entre ellos. Permitimos varios roles cubriendo TRAMOS
    // distintos del rango total.
    this.validateNoOverlap(dto.rules);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(BranchGroupAmountApprovalRuleEntity, { branchGroupId });
      if (dto.rules.length === 0) return [];
      const entities = dto.rules.map((r) =>
        manager.create(BranchGroupAmountApprovalRuleEntity, {
          branchGroupId,
          roleId: r.roleId,
          minUsd: r.minUsd,
          maxUsd: r.maxUsd,
        }),
      );
      await manager.save(entities);
      return manager.find(BranchGroupAmountApprovalRuleEntity, {
        where: { branchGroupId },
        relations: ['role'],
        order: { minUsd: 'ASC' },
      });
    });
  }

  private validateNoOverlap(rules: SetAmountRulesDto['rules']): void {
    // Validamos por par de filas: dos rangos [a, b] y [c, d] se solapan si a <= d y c <= b.
    // Tratamos `null` (sin tope) como +Infinity.
    const expanded = rules.map((r) => ({
      min: r.minUsd,
      max: r.maxUsd ?? Number.POSITIVE_INFINITY,
    }));
    for (let i = 0; i < expanded.length; i++) {
      const a = expanded[i];
      if (a.min >= a.max) {
        throw new BadRequestException(
          `El rango [${a.min}, ${rules[i].maxUsd ?? '∞'}] es inválido (mínimo debe ser menor que máximo).`,
        );
      }
      for (let j = i + 1; j < expanded.length; j++) {
        const b = expanded[j];
        if (a.min <= b.max && b.min <= a.max) {
          throw new BadRequestException(
            `Los rangos [${a.min}, ${rules[i].maxUsd ?? '∞'}] y ` +
              `[${b.min}, ${rules[j].maxUsd ?? '∞'}] se solapan. ` +
              `Cada monto debe ser cubierto por un solo rol.`,
          );
        }
      }
    }
  }

  // ─── Category rules ────────────────────────────────────────────────────
  async setCategoryRules(
    branchGroupId: string,
    dto: SetCategoryRulesDto,
  ): Promise<BranchGroupCategoryApprovalRuleEntity[]> {
    await this.ensureGroupExists(branchGroupId);

    return this.dataSource.transaction(async (manager) => {
      await manager.delete(BranchGroupCategoryApprovalRuleEntity, { branchGroupId });
      if (dto.rules.length === 0) return [];
      const entities = dto.rules.map((r) =>
        manager.create(BranchGroupCategoryApprovalRuleEntity, {
          branchGroupId,
          categoryFlag: r.categoryFlag,
          roleId: r.roleId,
        }),
      );
      await manager.save(entities);
      return manager.find(BranchGroupCategoryApprovalRuleEntity, {
        where: { branchGroupId },
        relations: ['role'],
      });
    });
  }

  // ─── Assign branches ───────────────────────────────────────────────────
  async assignBranches(branchGroupId: string, dto: AssignBranchesDto): Promise<{ assigned: number }> {
    await this.ensureGroupExists(branchGroupId);
    if (dto.branchIds.length === 0) return { assigned: 0 };
    const result = await this.branchRepo.update(dto.branchIds, { branchGroupId });
    return { assigned: result.affected ?? 0 };
  }

  private async ensureGroupExists(id: string): Promise<void> {
    const exists = await this.repo.findOne({ where: { id } });
    if (!exists) throw new NotFoundException('Grupo no encontrado');
  }
}
