import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { PromotionEntity } from './infrastructure/persistence/relational/entities/promotion.entity';
import { PromotionScopeEntity } from './infrastructure/persistence/relational/entities/promotion-scope.entity';
import {
  AddScopeDto,
  CreatePromotionDto,
  UpdatePromotionDto,
  QueryPromotionsDto,
  PromotionScopeInputDto,
  QueryApplicablePromotionsDto,
} from './dto';

/**
 * Cálculo de descuento aplicado por una promoción a una línea de venta.
 * `finalPriceUsd` es el total que paga el cliente después de aplicar la promo.
 */
export interface PromotionCalculation {
  promotionId: string;
  promotionName: string;
  type: PromotionEntity['type'];
  applicable: boolean;
  reason?: string;
  discountUsd: number;
  grossTotalUsd: number;
  finalTotalUsd: number;
  freeUnits?: number;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(PromotionEntity)
    private readonly promoRepo: Repository<PromotionEntity>,
    @InjectRepository(PromotionScopeEntity)
    private readonly scopeRepo: Repository<PromotionScopeEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private validateTypeFields(type: string, dto: Partial<CreatePromotionDto>): void {
    if (type === 'percentage') {
      if (dto.value == null || dto.value <= 0 || dto.value > 100) {
        throw new BadRequestException('percentage requiere value entre 0 (excl.) y 100');
      }
    } else if (type === 'fixed_amount') {
      if (dto.value == null || dto.value <= 0) {
        throw new BadRequestException('fixed_amount requiere value > 0 (USD)');
      }
    } else if (type === 'buy_x_get_y') {
      if (!dto.buyQuantity || dto.buyQuantity < 1 || !dto.getQuantity || dto.getQuantity < 1) {
        throw new BadRequestException('buy_x_get_y requiere buyQuantity >= 1 y getQuantity >= 1');
      }
    }
  }

  async create(dto: CreatePromotionDto, userId: string): Promise<PromotionEntity> {
    this.validateTypeFields(dto.type, dto);

    const effectiveFrom = new Date(dto.effectiveFrom);
    const effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException('effectiveTo debe ser posterior a effectiveFrom');
    }

    return this.dataSource.transaction(async (manager) => {
      const promo = manager.getRepository(PromotionEntity).create({
        name: dto.name,
        description: dto.description ?? null,
        type: dto.type,
        value: dto.type === 'buy_x_get_y' ? 0 : dto.value,
        buyQuantity: dto.type === 'buy_x_get_y' ? dto.buyQuantity! : null,
        getQuantity: dto.type === 'buy_x_get_y' ? dto.getQuantity! : null,
        minQuantity: dto.minQuantity ?? 1,
        maxUses: dto.maxUses ?? null,
        usesCount: 0,
        priority: dto.priority ?? 0,
        stackable: dto.stackable ?? false,
        effectiveFrom,
        effectiveTo,
        isActive: true,
        createdBy: userId,
      });

      const saved = await manager.save(promo);

      if (dto.scopes && dto.scopes.length > 0) {
        const scopes = dto.scopes.map((s) =>
          manager.getRepository(PromotionScopeEntity).create({
            promotionId: saved.id,
            scopeType: s.scopeType,
            scopeId: s.scopeId,
          }),
        );
        await manager.save(scopes);
      }

      return manager.getRepository(PromotionEntity).findOneOrFail({
        where: { id: saved.id },
        relations: ['scopes'],
      });
    });
  }

  async findAll(
    query: QueryPromotionsDto,
  ): Promise<{ data: PromotionEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.promoRepo.createQueryBuilder('p').leftJoinAndSelect('p.scopes', 'scope');

    if (query.type) qb.andWhere('p.type = :type', { type: query.type });
    if (query.isActive !== undefined) qb.andWhere('p.isActive = :isActive', { isActive: query.isActive });

    if (!query.includeExpired) {
      const at = query.activeAt ? new Date(query.activeAt) : new Date();
      qb.andWhere('p.isActive = true')
        .andWhere('p.effectiveFrom <= :at', { at })
        .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo > :at)', { at });
    }

    const [data, total] = await qb
      .orderBy('p.priority', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<PromotionEntity> {
    const promo = await this.promoRepo.findOne({ where: { id }, relations: ['scopes'] });
    if (!promo) throw new NotFoundException('Promoción no encontrada');
    return promo;
  }

  async update(id: string, dto: UpdatePromotionDto): Promise<PromotionEntity> {
    const promo = await this.findOne(id);

    if (dto.effectiveFrom) {
      const newFrom = new Date(dto.effectiveFrom);
      const currentTo = dto.effectiveTo ? new Date(dto.effectiveTo) : promo.effectiveTo;
      if (currentTo && currentTo <= newFrom) {
        throw new BadRequestException('effectiveTo debe ser posterior a effectiveFrom');
      }
      promo.effectiveFrom = newFrom;
    }
    if (dto.effectiveTo !== undefined) {
      promo.effectiveTo = dto.effectiveTo ? new Date(dto.effectiveTo) : null;
    }

    // Valida combinaciones de type+campos contra el type existente (no cambia)
    this.validateTypeFields(promo.type, { ...promo, ...dto } as any);

    if (dto.name !== undefined) promo.name = dto.name;
    if (dto.description !== undefined) promo.description = dto.description;
    if (dto.value !== undefined && promo.type !== 'buy_x_get_y') promo.value = dto.value;
    if (dto.buyQuantity !== undefined && promo.type === 'buy_x_get_y') promo.buyQuantity = dto.buyQuantity;
    if (dto.getQuantity !== undefined && promo.type === 'buy_x_get_y') promo.getQuantity = dto.getQuantity;
    if (dto.minQuantity !== undefined) promo.minQuantity = dto.minQuantity;
    if (dto.maxUses !== undefined) promo.maxUses = dto.maxUses;
    if (dto.priority !== undefined) promo.priority = dto.priority;
    if (dto.stackable !== undefined) promo.stackable = dto.stackable;

    return this.promoRepo.save(promo);
  }

  async setActive(id: string, isActive: boolean): Promise<PromotionEntity> {
    const promo = await this.findOne(id);
    promo.isActive = isActive;
    return this.promoRepo.save(promo);
  }

  async remove(id: string): Promise<void> {
    const res = await this.promoRepo.delete(id);
    if (res.affected === 0) throw new NotFoundException('Promoción no encontrada');
  }

  async addScope(promotionId: string, dto: AddScopeDto | PromotionScopeInputDto): Promise<PromotionScopeEntity> {
    await this.findOne(promotionId);
    try {
      return await this.scopeRepo.save(
        this.scopeRepo.create({
          promotionId,
          scopeType: dto.scopeType,
          scopeId: dto.scopeId,
        }),
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new BadRequestException('Este scope ya está registrado en la promoción');
      }
      throw err;
    }
  }

  async removeScope(promotionId: string, scopeId: string): Promise<void> {
    const res = await this.scopeRepo.delete({ id: scopeId, promotionId });
    if (res.affected === 0) throw new NotFoundException('Scope no encontrado en esta promoción');
  }

  /**
   * Resuelve todas las promociones aplicables a un producto (opcionalmente
   * filtrando por sucursal). Si se pasa `priceUsd` y `quantity`, cada
   * promoción viene con su `discountUsd` y `finalTotalUsd` calculados.
   *
   * Lógica de matching:
   *   - p.is_active = true, dentro de ventana de vigencia, uses_count < max_uses.
   *   - Producto matchea si la promo NO tiene scopes product/category, O
   *     si existe un scope 'product' con scope_id = productId, O si existe
   *     un scope 'category' con scope_id = categoría del producto.
   *   - Sucursal matchea si la promo NO tiene scopes branch, O si existe
   *     un scope 'branch' con scope_id = branchId.
   */
  async getApplicable(query: QueryApplicablePromotionsDto): Promise<PromotionCalculation[]> {
    const at = query.at ? new Date(query.at) : new Date();

    const qb = this.promoRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.scopes', 'scope')
      .where('p.isActive = true')
      .andWhere('p.effectiveFrom <= :at', { at })
      .andWhere('(p.effectiveTo IS NULL OR p.effectiveTo > :at)', { at })
      .andWhere('(p.maxUses IS NULL OR p.usesCount < p.maxUses)')
      .andWhere(
        `(
          NOT EXISTS (
            SELECT 1 FROM promotion_scopes s
            WHERE s.promotion_id = p.id AND s.scope_type IN ('product','category')
          )
          OR EXISTS (
            SELECT 1 FROM promotion_scopes s
            WHERE s.promotion_id = p.id AND s.scope_type = 'product' AND s.scope_id = :productId
          )
          OR EXISTS (
            SELECT 1 FROM promotion_scopes s
            INNER JOIN products pr ON pr.category_id = s.scope_id
            WHERE s.promotion_id = p.id AND s.scope_type = 'category' AND pr.id = :productId
          )
        )`,
        { productId: query.productId },
      );

    if (query.branchId) {
      qb.andWhere(
        `(
          NOT EXISTS (
            SELECT 1 FROM promotion_scopes s
            WHERE s.promotion_id = p.id AND s.scope_type = 'branch'
          )
          OR EXISTS (
            SELECT 1 FROM promotion_scopes s
            WHERE s.promotion_id = p.id AND s.scope_type = 'branch' AND s.scope_id = :branchId
          )
        )`,
        { branchId: query.branchId },
      );
    } else {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM promotion_scopes s
          WHERE s.promotion_id = p.id AND s.scope_type = 'branch'
        )`,
      );
    }

    qb.orderBy('p.priority', 'DESC').addOrderBy('p.createdAt', 'DESC');

    const promos = await qb.getMany();

    return promos.map((p) => this.calculateDiscount(p, query.priceUsd, query.quantity));
  }

  /**
   * Calcula el descuento aplicado a una línea (priceUsd × quantity) por una promo.
   * Si priceUsd o quantity no vienen, retorna la promo marcada como aplicable sin
   * montos calculados (sirve como preview/listado).
   */
  calculateDiscount(promotion: PromotionEntity, priceUsd?: number, quantity?: number): PromotionCalculation {
    const base: PromotionCalculation = {
      promotionId: promotion.id,
      promotionName: promotion.name,
      type: promotion.type,
      applicable: true,
      discountUsd: 0,
      grossTotalUsd: 0,
      finalTotalUsd: 0,
    };

    if (priceUsd == null || quantity == null || quantity <= 0) {
      // Preview sin montos: la promo potencialmente aplica pero no hay datos para calcular.
      return base;
    }

    const price = Number(priceUsd);
    const qty = Number(quantity);
    const grossTotalUsd = +(price * qty).toFixed(4);
    base.grossTotalUsd = grossTotalUsd;

    if (qty < Number(promotion.minQuantity)) {
      return {
        ...base,
        applicable: false,
        reason: `Cantidad mínima requerida: ${promotion.minQuantity}`,
        finalTotalUsd: grossTotalUsd,
      };
    }

    let discountUsd = 0;
    let freeUnits: number | undefined;

    if (promotion.type === 'percentage') {
      discountUsd = +(grossTotalUsd * (Number(promotion.value) / 100)).toFixed(4);
    } else if (promotion.type === 'fixed_amount') {
      const perUnit = Math.min(Number(promotion.value), price);
      discountUsd = +(perUnit * qty).toFixed(4);
    } else if (promotion.type === 'buy_x_get_y') {
      const buy = promotion.buyQuantity ?? 0;
      const get = promotion.getQuantity ?? 0;
      const bundle = buy + get;
      if (bundle > 0) {
        const completeBundles = Math.floor(qty / bundle);
        freeUnits = completeBundles * get;
        discountUsd = +(freeUnits * price).toFixed(4);
      }
    }

    // Clamp: el descuento no puede exceder el total bruto.
    if (discountUsd > grossTotalUsd) discountUsd = grossTotalUsd;

    return {
      ...base,
      discountUsd,
      finalTotalUsd: +(grossTotalUsd - discountUsd).toFixed(4),
      freeUnits,
    };
  }

  /**
   * Registra el uso de una promoción (incrementa `uses_count` atómicamente).
   * El POS lo invocaría al cerrar una venta. Falla si se excedió `max_uses`.
   */
  async recordUse(id: string): Promise<PromotionEntity> {
    return this.dataSource.transaction(async (manager) => {
      const promo = await manager
        .getRepository(PromotionEntity)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();

      if (!promo) throw new NotFoundException('Promoción no encontrada');
      if (!promo.isActive) throw new BadRequestException('Promoción inactiva');
      if (promo.maxUses != null && promo.usesCount >= promo.maxUses) {
        throw new BadRequestException('Promoción alcanzó su límite de usos');
      }

      promo.usesCount += 1;
      return manager.save(promo);
    });
  }
}
