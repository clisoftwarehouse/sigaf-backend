import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { PriceEntity } from './infrastructure/persistence/relational/entities/price.entity';
import { CreatePriceDto, UpdatePriceDto, QueryPricesDto, QueryCurrentPriceDto } from './dto';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

/**
 * Resolución de precio vigente.
 * - `source='branch_override'`: precio específico para una sucursal.
 * - `source='global'`         : precio sin `branchId` (aplica a todas).
 * - `source='pmvp_fallback'`  : sin row en `prices`, cae al `product.pmvp`
 *   (precio máximo de venta al público). Necesario para que el admin vea el
 *   mismo precio que el POS, que ya usa este fallback en el listado de
 *   `/v1/products`.
 *
 * El módulo de precios es la única fuente de verdad. Las recepciones publican
 * el precio de venta aquí automáticamente, y la migración 1777300000000 sembró
 * los precios históricos desde los lotes existentes.
 */
export interface ResolvedPrice {
  priceUsd: number;
  source: 'branch_override' | 'global' | 'any_branch_fallback' | 'pmvp_fallback';
  priceId: string;
  effectiveFrom: Date;
  notes: string | null;
  productId: string;
  branchId: string | null;
  resolvedAt: Date;
}

/**
 * Información del factor de revaluación vigente.
 *
 * - `factor`: multiplicador aplicado al precio principal para obtener el
 *   precio efectivo cobrado al cliente. 1.0 cuando el modo reposición está
 *   inactivo (no hay tasa REPOSICION, o REPOSICION ≤ BCV).
 * - `active`: true cuando factor > 1.0.
 * - `bcvRate` / `reposicionRate`: tasas usadas para calcular el factor
 *   (null si no están disponibles).
 */
export interface RevaluationFactor {
  factor: number;
  active: boolean;
  bcvRate: number | null;
  reposicionRate: number | null;
}

/**
 * Precio efectivo: precio principal + factor de revaluación aplicado.
 */
export interface EffectivePrice extends ResolvedPrice {
  /** Multiplicador activo (1.0 si modo reposición OFF). */
  revaluationFactor: number;
  /** priceUsd × revaluationFactor — lo que el cliente paga en USD. */
  effectivePriceUsd: number;
  /** Tasa BCV usada para convertir el precio efectivo a Bs. */
  exchangeRateBcv: number | null;
  /** effectivePriceUsd × exchangeRateBcv — lo que se cobra en Bs. */
  effectivePriceBs: number | null;
}

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(PriceEntity)
    private readonly repo: Repository<PriceEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /**
   * Calcula el factor de revaluación vigente comparando la tasa de reposición
   * con la tasa BCV oficial. Si la reposición es menor o igual al BCV o no
   * existe, el factor es 1.0 (modo reposición inactivo).
   */
  async getRevaluationFactor(): Promise<RevaluationFactor> {
    const [bcv, repo] = await Promise.all([
      this.exchangeRatesService.getLatest('USD', 'VES', 'BCV'),
      this.exchangeRatesService.getLatest('USD', 'VES', 'REPOSICION'),
    ]);
    const bcvRate = bcv ? Number(bcv.rate) : null;
    const reposicionRate = repo ? Number(repo.rate) : null;
    if (!bcvRate || !reposicionRate || bcvRate <= 0 || reposicionRate <= bcvRate) {
      return { factor: 1.0, active: false, bcvRate, reposicionRate };
    }
    const factor = +(reposicionRate / bcvRate).toFixed(6);
    return { factor, active: true, bcvRate, reposicionRate };
  }

  /**
   * Resuelve el precio principal y le aplica el factor de revaluación vigente.
   * Retorna también la conversión a Bs usando tasa BCV (oficial).
   *
   * Garantía contable: el priceUsd "principal" (lo que se ve en catálogo /
   * etiquetas SUNDDE) NO cambia. El factor solo afecta `effectivePriceUsd`
   * (lo que el cliente paga al momento del cobro).
   */
  async getEffectivePrice(query: QueryCurrentPriceDto): Promise<EffectivePrice> {
    const [resolved, revaluation] = await Promise.all([this.getCurrentPrice(query), this.getRevaluationFactor()]);
    const effectivePriceUsd = +(resolved.priceUsd * revaluation.factor).toFixed(4);
    const exchangeRateBcv = revaluation.bcvRate;
    const effectivePriceBs = exchangeRateBcv != null ? +(effectivePriceUsd * exchangeRateBcv).toFixed(2) : null;
    return {
      ...resolved,
      revaluationFactor: revaluation.factor,
      effectivePriceUsd,
      exchangeRateBcv,
      effectivePriceBs,
    };
  }

  /**
   * Crea un nuevo precio. Si ya existe uno vigente para el mismo scope
   * (product + branchId|null), lo cierra automáticamente seteando
   * `effective_to = new.effectiveFrom` dentro de la misma transacción.
   *
   * El unique index parcial `ux_prices_active_scope` garantiza que nunca
   * pueda haber dos precios vigentes simultáneos para el mismo scope
   * aunque dos requests lleguen en paralelo (el segundo falla con conflict).
   */
  async create(dto: CreatePriceDto, userId: string): Promise<PriceEntity> {
    return this.dataSource.transaction(async (manager) => {
      const effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date();

      // Cerrar vigencia abierta del mismo scope (si existe).
      await manager
        .createQueryBuilder()
        .update(PriceEntity)
        .set({ effectiveTo: effectiveFrom, updatedAt: new Date() })
        .where('product_id = :productId', { productId: dto.productId })
        .andWhere(dto.branchId ? 'branch_id = :branchId' : 'branch_id IS NULL', { branchId: dto.branchId })
        .andWhere('effective_to IS NULL')
        .execute();

      const price = manager.getRepository(PriceEntity).create({
        productId: dto.productId,
        branchId: dto.branchId ?? null,
        priceUsd: dto.priceUsd,
        effectiveFrom,
        effectiveTo: null,
        notes: dto.notes ?? null,
        createdBy: userId,
      });

      return manager.save(price);
    });
  }

  async findAll(query: QueryPricesDto): Promise<{ data: PriceEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.repo.createQueryBuilder('p');

    if (query.productId) qb.andWhere('p.productId = :productId', { productId: query.productId });
    if (query.branchId) qb.andWhere('p.branchId = :branchId', { branchId: query.branchId });

    if (!query.includeHistory) {
      // "No histórico" = precios todavía válidos en `at` (vigentes hoy o
      // programados para fecha futura). Sólo se excluyen los EXPIRADOS, no
      // los futuros: si un operador programó un precio para mañana, debe
      // verlo en el listado o se vuelve invisible hasta que se active solo.
      // Se permite `activeAt` para inspeccionar el estado en otra fecha.
      const at = query.activeAt ? new Date(query.activeAt) : new Date();
      qb.andWhere('(p.effectiveTo IS NULL OR p.effectiveTo > :at)', { at });
    }

    const [data, total] = await qb
      .orderBy('p.effectiveFrom', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<PriceEntity> {
    const price = await this.repo.findOne({ where: { id } });
    if (!price) throw new NotFoundException('Precio no encontrado');
    return price;
  }

  /**
   * Corrección sobre un precio existente. Si se modifica `priceUsd` se exige
   * `justification` y se registra en `audit_log` (action=UPDATE, table=prices)
   * con old/new values y la justificación dada por el usuario.
   *
   * Esto NO crea una nueva vigencia — usar `create()` para precios nuevos.
   */
  async update(id: string, dto: UpdatePriceDto, userId: string): Promise<PriceEntity> {
    const price = await this.findOne(id);
    const oldValues = { priceUsd: Number(price.priceUsd), notes: price.notes };

    const priceChanged = dto.priceUsd != null && Number(dto.priceUsd) !== Number(price.priceUsd);
    if (priceChanged && !dto.justification) {
      throw new BadRequestException('Se requiere justificación para modificar el precio');
    }

    if (dto.priceUsd != null) price.priceUsd = dto.priceUsd;
    if (dto.notes !== undefined) price.notes = dto.notes;

    const updated = await this.repo.save(price);

    if (priceChanged) {
      await this.auditService.log({
        tableName: 'prices',
        recordId: id,
        action: 'UPDATE',
        oldValues,
        newValues: { priceUsd: Number(updated.priceUsd), notes: updated.notes },
        justification: dto.justification,
        userId,
      });
    }

    return updated;
  }

  /**
   * Cierra la vigencia manualmente (`effective_to = now()`).
   * Después de esto, el producto vuelve a usar el siguiente nivel de la cascada
   * (global si era override de sucursal, o lot_fallback si era global).
   */
  async expire(id: string): Promise<PriceEntity> {
    const price = await this.findOne(id);
    if (price.effectiveTo) throw new BadRequestException('Este precio ya estaba expirado');
    price.effectiveTo = new Date();
    return this.repo.save(price);
  }

  /**
   * Resuelve el precio vigente aplicando la prelación:
   *   1. Override por sucursal (si se pasó `branchId`)
   *   2. Precio global
   *
   * Lanza NotFoundException si no hay precio publicado para el producto.
   */
  async getCurrentPrice(query: QueryCurrentPriceDto): Promise<ResolvedPrice> {
    const at = query.at ? new Date(query.at) : new Date();

    // 1. Override por sucursal
    if (query.branchId) {
      const override = await this.repo.findOne({
        where: [
          {
            productId: query.productId,
            branchId: query.branchId,
            effectiveFrom: LessThanOrEqual(at),
            effectiveTo: IsNull(),
          },
          {
            productId: query.productId,
            branchId: query.branchId,
            effectiveFrom: LessThanOrEqual(at),
            effectiveTo: MoreThan(at),
          },
        ],
        order: { effectiveFrom: 'DESC' },
      });

      if (override) {
        return {
          priceUsd: Number(override.priceUsd),
          source: 'branch_override',
          priceId: override.id,
          effectiveFrom: override.effectiveFrom,
          notes: override.notes,
          productId: query.productId,
          branchId: query.branchId,
          resolvedAt: at,
        };
      }
    }

    // 2. Precio global
    const global = await this.repo.findOne({
      where: [
        {
          productId: query.productId,
          branchId: IsNull(),
          effectiveFrom: LessThanOrEqual(at),
          effectiveTo: IsNull(),
        },
        {
          productId: query.productId,
          branchId: IsNull(),
          effectiveFrom: LessThanOrEqual(at),
          effectiveTo: MoreThan(at),
        },
      ],
      order: { effectiveFrom: 'DESC' },
    });

    if (global) {
      return {
        priceUsd: Number(global.priceUsd),
        source: 'global',
        priceId: global.id,
        effectiveFrom: global.effectiveFrom,
        notes: global.notes,
        productId: query.productId,
        branchId: query.branchId ?? null,
        resolvedAt: at,
      };
    }

    // 3. Fallback any-branch: cuando la consulta NO pasó branchId (típica
    // de vistas administrativas que no están scoped a una sucursal) y no
    // hay precio global, devolvemos el precio vigente más reciente de
    // cualquier sucursal. Evita "Sin precio publicado" en el detalle de
    // producto cuando sí hay precios pero solo por sucursal.
    if (!query.branchId) {
      const anyBranch = await this.repo.findOne({
        where: [
          {
            productId: query.productId,
            effectiveFrom: LessThanOrEqual(at),
            effectiveTo: IsNull(),
          },
          {
            productId: query.productId,
            effectiveFrom: LessThanOrEqual(at),
            effectiveTo: MoreThan(at),
          },
        ],
        order: { effectiveFrom: 'DESC' },
      });
      if (anyBranch) {
        return {
          priceUsd: Number(anyBranch.priceUsd),
          source: 'any_branch_fallback',
          priceId: anyBranch.id,
          effectiveFrom: anyBranch.effectiveFrom,
          notes: anyBranch.notes,
          productId: query.productId,
          branchId: anyBranch.branchId,
          resolvedAt: at,
        };
      }
    }

    // 4. Fallback al `product.pmvp` — mismo comportamiento que `/v1/products`
    // usa para enriquecer el catálogo del POS. Sin esto el admin veía "Sin
    // precio publicado" en stock detail aunque el POS sí mostraba precio
    // (vía pmvp), creando confusión.
    const product = await this.productRepo.findOne({
      where: { id: query.productId },
      select: ['id', 'pmvp'],
    });
    if (product && product.pmvp != null) {
      const pmvp = Number(product.pmvp);
      if (Number.isFinite(pmvp) && pmvp > 0) {
        return {
          priceUsd: pmvp,
          source: 'pmvp_fallback',
          priceId: product.id,
          effectiveFrom: at,
          notes: null,
          productId: query.productId,
          branchId: query.branchId ?? null,
          resolvedAt: at,
        };
      }
    }

    throw new NotFoundException(
      `No hay precio publicado para el producto ${query.productId}` +
        (query.branchId ? ` (sucursal ${query.branchId})` : '') +
        '. Publica un precio desde el módulo de precios o al registrar una recepción.',
    );
  }
}
