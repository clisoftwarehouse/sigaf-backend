import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository, DataSource, LessThanOrEqual } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { PriceEntity } from './infrastructure/persistence/relational/entities/price.entity';
import { CreatePriceDto, UpdatePriceDto, QueryPricesDto, QueryCurrentPriceDto } from './dto';

/**
 * Resolución de precio vigente.
 * - `source='branch_override'`: precio específico para una sucursal.
 * - `source='global'`         : precio sin `branchId` (aplica a todas).
 *
 * El módulo de precios es la única fuente de verdad. Las recepciones publican
 * el precio de venta aquí automáticamente, y la migración 1777300000000 sembró
 * los precios históricos desde los lotes existentes.
 */
export interface ResolvedPrice {
  priceUsd: number;
  source: 'branch_override' | 'global';
  priceId: string;
  effectiveFrom: Date;
  notes: string | null;
  productId: string;
  branchId: string | null;
  resolvedAt: Date;
}

@Injectable()
export class PricesService {
  constructor(
    @InjectRepository(PriceEntity)
    private readonly repo: Repository<PriceEntity>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

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
      const at = query.activeAt ? new Date(query.activeAt) : new Date();
      qb.andWhere('p.effectiveFrom <= :at', { at }).andWhere('(p.effectiveTo IS NULL OR p.effectiveTo > :at)', { at });
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

    throw new NotFoundException(
      `No hay precio publicado para el producto ${query.productId}` +
        (query.branchId ? ` (sucursal ${query.branchId})` : '') +
        '. Publica un precio desde el módulo de precios o al registrar una recepción.',
    );
  }
}
