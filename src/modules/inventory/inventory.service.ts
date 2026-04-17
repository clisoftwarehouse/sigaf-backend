import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, DataSource, Repository } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCountEntity } from './infrastructure/persistence/relational/entities/inventory-count.entity';
import { InventoryCountItemEntity } from './infrastructure/persistence/relational/entities/inventory-count-item.entity';
import { InventoryCyclicScheduleEntity } from './infrastructure/persistence/relational/entities/inventory-cyclic-schedule.entity';
import {
  QueryStockDto,
  ConsumeFefoDto,
  QueryKardexDto,
  CancelCountDto,
  RecountItemDto,
  ReturnToLotDto,
  ApproveCountDto,
  QueryAccuracyDto,
  QuarantineLotDto,
  CountItemUpdateDto,
  CreateAdjustmentDto,
  QueryStockDetailDto,
  QueryAdjustmentsDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
  QueryInventoryCountDto,
  QueryCyclicScheduleDto,
  BulkUpdateCountItemsDto,
  CreateInventoryCountDto,
  CreateCyclicScheduleDto,
  UpdateCyclicScheduleDto,
  QueryCostOfSalePreviewDto,
} from './dto';

export interface ExpirySignalLot {
  id: string;
  productId: string;
  branchId: string;
  lotNumber: string;
  expirationDate: Date;
  manufactureDate: Date | null;
  acquisitionType: string;
  supplierId: string | null;
  consignmentEntryId: string | null;
  costUsd: number;
  salePrice: number;
  marginPct: number | null;
  quantityReceived: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantitySold: number;
  quantityDamaged: number;
  quantityReturned: number;
  locationId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expirySignal: 'EXPIRED' | 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
}

export type InventoryCountWithItems = InventoryCountEntity & { items: InventoryCountItemEntity[] };

/**
 * Resumen de stock agregado por producto/sucursal con datos enriquecidos.
 * - `totalQuantity`: stock disponible actual (SUM quantity_available de lotes 'available').
 * - `quantityReserved`: stock reservado (toma de inventario, ventas pendientes).
 * - `quantitySold` / `quantityDamaged`: histórico acumulado a nivel de lote.
 * - `lastCountDate` / `lastCountQuantity`: última toma de inventario aprobada.
 * - `lastMovementDate`: fecha del último movimiento de kardex.
 */
export interface StockSummary {
  productId: string;
  branchId: string;
  totalQuantity: number;
  quantityReserved: number;
  quantitySold: number;
  quantityDamaged: number;
  lotCount: number;
  nearestExpiration: Date | null;
  lastCountDate: Date | null;
  lastCountQuantity: number | null;
  lastMovementDate: Date | null;
}

/**
 * Lote con movimientos de kardex recientes embebidos.
 * Usado en `getStockDetail` para la vista unificada Stock ↔ Lotes ↔ Kardex.
 */
export type LotWithMovements = ExpirySignalLot & {
  movements: KardexEntity[];
};

/**
 * Detalle unificado de stock por producto: info del producto + resumen agregado
 * por sucursal + lotes con sus movimientos recientes.
 */
export interface ProductStockDetail {
  product: {
    id: string;
    internalCode: string | null;
    description: string;
    unitOfMeasure: string;
    stockMin: number;
    stockMax: number | null;
    reorderPoint: number | null;
    isActive: boolean;
  };
  summary: StockSummary[];
  lots: LotWithMovements[];
}

/**
 * Línea del plan FEFO: cuánto se consume de un lote y su costo.
 */
export interface FefoConsumptionLine {
  lotId: string;
  lotNumber: string;
  expirationDate: Date;
  unitCostUsd: number;
  quantityToConsume: number;
  /** unitCostUsd * quantityToConsume (USD) */
  lineCostUsd: number;
}

/**
 * Plan de consumo FEFO + COGS.
 * - `lines`: lotes afectados en orden de vencimiento (más próximo primero).
 * - `totalCostUsd`: suma de `lineCostUsd` — es el COGS (Cost of Goods Sold).
 * - `weightedAverageCostUsd`: totalCostUsd / totalQuantity (costo promedio ponderado).
 * - `shortfallQuantity`: si no hay stock suficiente, cuántas unidades faltaron.
 *   Si `> 0`, `consumeFefo` rechazará la operación.
 * - `marginUsd` / `marginPct`: solo presentes cuando el preview se llama con `salePriceUsd`.
 */
export interface FefoConsumptionPlan {
  productId: string;
  branchId: string;
  requestedQuantity: number;
  fulfilledQuantity: number;
  shortfallQuantity: number;
  totalCostUsd: number;
  weightedAverageCostUsd: number;
  lines: FefoConsumptionLine[];
  salePriceUsd?: number;
  grossRevenueUsd?: number;
  marginUsd?: number;
  marginPct?: number;
}

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
    @InjectRepository(InventoryCountEntity)
    private readonly countRepo: Repository<InventoryCountEntity>,
    @InjectRepository(InventoryCountItemEntity)
    private readonly countItemRepo: Repository<InventoryCountItemEntity>,
    @InjectRepository(InventoryCyclicScheduleEntity)
    private readonly cyclicScheduleRepo: Repository<InventoryCyclicScheduleEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findAllLots(
    query: QueryInventoryLotDto,
  ): Promise<{ data: ExpirySignalLot[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.lotRepo.createQueryBuilder('lot');

    if (query.productId) {
      qb.andWhere('lot.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.locationId) {
      qb.andWhere('lot.locationId = :locationId', { locationId: query.locationId });
    }
    if (query.status) {
      qb.andWhere('lot.status = :status', { status: query.status });
    }

    const [lots, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('lot.expirationDate', 'ASC')
      .getManyAndCount();

    const data = lots.map((lot) => this.addExpirySignal(lot));

    if (query.expirySignal) {
      const filtered = data.filter((lot) => lot.expirySignal === query.expirySignal);
      return { data: filtered, total: filtered.length, page, limit };
    }

    return { data, total, page, limit };
  }

  async findOneLot(id: string): Promise<ExpirySignalLot> {
    const lot = await this.lotRepo.findOne({ where: { id } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    return this.addExpirySignal(lot);
  }

  async createLot(dto: CreateInventoryLotDto, userId: string): Promise<InventoryLotEntity> {
    const marginPct = dto.salePrice > 0 && dto.costUsd > 0 ? ((dto.salePrice - dto.costUsd) / dto.costUsd) * 100 : null;

    const lot = this.lotRepo.create({
      ...dto,
      expirationDate: new Date(dto.expirationDate),
      manufactureDate: dto.manufactureDate ? new Date(dto.manufactureDate) : null,
      quantityAvailable: dto.quantityReceived,
      marginPct,
    });

    const saved = await this.lotRepo.save(lot);

    await this.createKardexEntry({
      productId: saved.productId,
      branchId: saved.branchId,
      lotId: saved.id,
      movementType: dto.acquisitionType === 'consignment' ? 'consignment_entry' : 'purchase_entry',
      quantity: dto.quantityReceived,
      unitCostUsd: dto.costUsd,
      referenceType: 'inventory_lot',
      referenceId: saved.id,
      userId,
    });

    return saved;
  }

  async updateLot(id: string, dto: UpdateInventoryLotDto, userId: string): Promise<InventoryLotEntity> {
    const lot = await this.findOneLot(id);
    const oldValues = { ...lot };

    Object.assign(lot, dto);
    const updated = await this.lotRepo.save(lot);

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: id,
      action: 'UPDATE',
      oldValues,
      newValues: updated,
      userId,
    });

    return updated;
  }

  async setQuarantine(id: string, dto: QuarantineLotDto, userId: string): Promise<InventoryLotEntity> {
    const lot = await this.findOneLot(id);
    const oldStatus = lot.status;

    lot.status = dto.quarantine ? 'quarantine' : 'available';
    const updated = await this.lotRepo.save(lot);

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: id,
      action: 'UPDATE',
      oldValues: { status: oldStatus },
      newValues: { status: lot.status },
      justification: dto.reason,
      userId,
    });

    return updated;
  }

  async getStockFefo(query: { productId?: string; branchId?: string }): Promise<ExpirySignalLot[]> {
    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .where("lot.status = 'available'")
      .andWhere('lot.quantityAvailable > 0');

    if (query.productId) {
      qb.andWhere('lot.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }

    const lots = await qb.orderBy('lot.expirationDate', 'ASC').getMany();

    return lots.map((lot) => this.addExpirySignal(lot));
  }

  async getStock(query: QueryStockDto): Promise<{
    data: StockSummary[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: string[] = ["lot.status = 'available'"];
    const params: unknown[] = [];

    if (query.productId) {
      params.push(query.productId);
      where.push(`lot.product_id = $${params.length}`);
    }
    if (query.branchId) {
      params.push(query.branchId);
      where.push(`lot.branch_id = $${params.length}`);
    }
    if (query.categoryId) {
      params.push(query.categoryId);
      where.push(`EXISTS (SELECT 1 FROM products p WHERE p.id = lot.product_id AND p.category_id = $${params.length})`);
    }

    const whereClause = where.join(' AND ');

    const sql = `
      WITH base AS (
        SELECT
          lot.product_id AS "productId",
          lot.branch_id AS "branchId",
          COALESCE(SUM(lot.quantity_available), 0)::numeric AS "totalQuantity",
          COALESCE(SUM(lot.quantity_reserved), 0)::numeric AS "quantityReserved",
          COALESCE(SUM(lot.quantity_sold), 0)::numeric AS "quantitySold",
          COALESCE(SUM(lot.quantity_damaged), 0)::numeric AS "quantityDamaged",
          COUNT(lot.id)::int AS "lotCount",
          MIN(lot.expiration_date) AS "nearestExpiration"
        FROM inventory_lots lot
        WHERE ${whereClause}
        GROUP BY lot.product_id, lot.branch_id
      )
      SELECT
        base.*,
        lc."lastCountDate",
        lc."lastCountQuantity",
        (SELECT MAX(k.created_at)
           FROM kardex k
          WHERE k.product_id = base."productId" AND k.branch_id = base."branchId"
        ) AS "lastMovementDate"
      FROM base
      LEFT JOIN LATERAL (
        SELECT
          ic.completed_at AS "lastCountDate",
          SUM(ici.counted_quantity)::numeric AS "lastCountQuantity"
        FROM inventory_counts ic
        JOIN inventory_count_items ici ON ici.count_id = ic.id
        WHERE ic.status = 'approved'
          AND ic.branch_id = base."branchId"
          AND ici.product_id = base."productId"
        GROUP BY ic.id, ic.completed_at
        ORDER BY ic.completed_at DESC NULLS LAST
        LIMIT 1
      ) lc ON TRUE
      ORDER BY base."productId", base."branchId"
    `;

    type RawStockRow = {
      productId: string;
      branchId: string;
      totalQuantity: string | number;
      quantityReserved: string | number;
      quantitySold: string | number;
      quantityDamaged: string | number;
      lotCount: string | number;
      nearestExpiration: string | null;
      lastCountDate: string | null;
      lastCountQuantity: string | number | null;
      lastMovementDate: string | null;
    };

    const rawRows = await this.lotRepo.manager.query<RawStockRow[]>(sql, params);

    let rows: StockSummary[] = rawRows.map((r) => ({
      productId: r.productId,
      branchId: r.branchId,
      totalQuantity: Number(r.totalQuantity) || 0,
      quantityReserved: Number(r.quantityReserved) || 0,
      quantitySold: Number(r.quantitySold) || 0,
      quantityDamaged: Number(r.quantityDamaged) || 0,
      lotCount: Number(r.lotCount) || 0,
      nearestExpiration: r.nearestExpiration ? new Date(r.nearestExpiration) : null,
      lastCountDate: r.lastCountDate ? new Date(r.lastCountDate) : null,
      lastCountQuantity: r.lastCountQuantity != null ? Number(r.lastCountQuantity) : null,
      lastMovementDate: r.lastMovementDate ? new Date(r.lastMovementDate) : null,
    }));

    if (query.stockStatus === 'out') {
      rows = rows.filter((item) => item.totalQuantity === 0);
    } else if (query.stockStatus === 'low') {
      rows = rows.filter((item) => item.totalQuantity > 0 && item.totalQuantity <= 10);
    } else if (query.stockStatus === 'normal') {
      rows = rows.filter((item) => item.totalQuantity > 10);
    }

    const total = rows.length;
    const paginatedData = rows.slice((page - 1) * limit, page * limit);

    return { data: paginatedData, total, page, limit };
  }

  /**
   * Devuelve el detalle unificado de stock para un producto:
   *  - Info básica del producto
   *  - Resumen agregado por sucursal (reutiliza `getStock`)
   *  - Lotes del producto (opcionalmente filtrados por sucursal) con los
   *    últimos movimientos de kardex embebidos
   *
   * Unifica la vista Stock ↔ Lotes ↔ Kardex en un único endpoint.
   */
  async getStockDetail(productId: string, query: QueryStockDetailDto): Promise<ProductStockDetail> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const movementsLimit = query.movementsLimit ?? 20;

    // 1. Resumen agregado (una fila por sucursal)
    const { data: summary } = await this.getStock({
      productId,
      branchId: query.branchId,
      page: 1,
      limit: 1000,
    });

    // 2. Lotes del producto
    const lotQb = this.lotRepo.createQueryBuilder('lot').where('lot.productId = :productId', { productId });
    if (query.branchId) {
      lotQb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }
    const lots = await lotQb.orderBy('lot.expirationDate', 'ASC').getMany();

    if (lots.length === 0) {
      return {
        product: {
          id: product.id,
          internalCode: product.internalCode,
          description: product.description,
          unitOfMeasure: product.unitOfMeasure,
          stockMin: Number(product.stockMin),
          stockMax: product.stockMax != null ? Number(product.stockMax) : null,
          reorderPoint: product.reorderPoint != null ? Number(product.reorderPoint) : null,
          isActive: product.isActive,
        },
        summary,
        lots: [],
      };
    }

    // 3. Movimientos de kardex por lote (una consulta agregada)
    const lotIds = lots.map((l) => l.id);
    const movements = await this.kardexRepo
      .createQueryBuilder('k')
      .where('k.lotId IN (:...lotIds)', { lotIds })
      .orderBy('k.createdAt', 'DESC')
      .getMany();

    // Agrupar y limitar a `movementsLimit` movimientos por lote
    const movementsByLot = new Map<string, KardexEntity[]>();
    for (const mv of movements) {
      if (!mv.lotId) continue;
      const arr = movementsByLot.get(mv.lotId) ?? [];
      if (arr.length < movementsLimit) arr.push(mv);
      movementsByLot.set(mv.lotId, arr);
    }

    const lotsWithMovements: LotWithMovements[] = lots.map((lot) => ({
      ...this.addExpirySignal(lot),
      movements: movementsByLot.get(lot.id) ?? [],
    }));

    return {
      product: {
        id: product.id,
        internalCode: product.internalCode,
        description: product.description,
        unitOfMeasure: product.unitOfMeasure,
        stockMin: Number(product.stockMin),
        stockMax: product.stockMax != null ? Number(product.stockMax) : null,
        reorderPoint: product.reorderPoint != null ? Number(product.reorderPoint) : null,
        isActive: product.isActive,
      },
      summary,
      lots: lotsWithMovements,
    };
  }

  async createAdjustment(dto: CreateAdjustmentDto, userId: string): Promise<KardexEntity> {
    if (dto.quantity === 0) {
      throw new BadRequestException('La cantidad del ajuste no puede ser cero');
    }

    const lot = await this.findOneLot(dto.lotId);

    if (lot.productId !== dto.productId) {
      throw new BadRequestException('El lote no pertenece al producto indicado');
    }
    if (lot.branchId !== dto.branchId) {
      throw new BadRequestException('El lote no pertenece a la sucursal indicada');
    }

    const newQuantity = Number(lot.quantityAvailable) + dto.quantity;
    if (newQuantity < 0) {
      throw new BadRequestException(
        `Cantidad insuficiente en el lote (disponible: ${lot.quantityAvailable}, ajuste solicitado: ${dto.quantity})`,
      );
    }

    lot.quantityAvailable = newQuantity;

    // Solo los ajustes de tipo 'damage' incrementan quantityDamaged.
    // correction / count_difference / expiry_write_off no alteran ese contador.
    if (dto.quantity < 0 && dto.adjustmentType === 'damage') {
      lot.quantityDamaged = Number(lot.quantityDamaged) + Math.abs(dto.quantity);
    }
    await this.lotRepo.save(lot);

    const movementType = dto.quantity > 0 ? 'adjustment_in' : 'adjustment_out';

    const kardex = await this.createKardexEntry({
      productId: dto.productId,
      branchId: dto.branchId,
      lotId: dto.lotId,
      movementType,
      quantity: dto.quantity,
      referenceType: 'adjustment',
      notes: `${dto.adjustmentType}: ${dto.reason}`,
      userId,
    });

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: dto.lotId,
      action: 'UPDATE',
      justification: `[${dto.adjustmentType}] ${dto.reason}`,
      userId,
    });

    return kardex;
  }

  /**
   * Lista los ajustes de inventario registrados (movimientos de kardex con
   * reference_type='adjustment'). Soporta filtros por producto, sucursal, lote,
   * tipo de ajuste y rango de fechas.
   */
  async getAdjustments(
    query: QueryAdjustmentsDto,
  ): Promise<{ data: KardexEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.kardexRepo.createQueryBuilder('k').where("k.referenceType = 'adjustment'");

    if (query.productId) {
      qb.andWhere('k.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('k.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.lotId) {
      qb.andWhere('k.lotId = :lotId', { lotId: query.lotId });
    }
    if (query.adjustmentType) {
      // El tipo se persiste en notes con prefijo "<adjustmentType>:".
      qb.andWhere('k.notes LIKE :prefix', { prefix: `${query.adjustmentType}:%` });
    }
    if (query.direction === 'in') {
      qb.andWhere("k.movementType = 'adjustment_in'");
    } else if (query.direction === 'out') {
      qb.andWhere("k.movementType = 'adjustment_out'");
    }
    if (query.from) {
      qb.andWhere('k.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('k.createdAt <= :to', { to: new Date(query.to) });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('k.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Lógica de costo de venta (FEFO + COGS)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Planifica cuáles lotes disponibles se consumirían para cubrir una cantidad
   * dada, en orden FEFO (First-Expire-First-Out) — el vencimiento más próximo
   * sale primero. Solo considera lotes con `status='available'`, no vencidos
   * y con `quantity_available > 0`.
   *
   * No persiste nada. Útil para previsualizar una venta antes de ejecutarla.
   *
   * Cálculos:
   * - `lineCostUsd = unitCostUsd * quantityToConsume`
   * - `totalCostUsd = Σ lineCostUsd` → **COGS** de la operación
   * - `weightedAverageCostUsd = totalCostUsd / fulfilledQuantity`
   * - Si `salePriceUsd` se provee: `marginUsd = (salePrice - avgCost) * qty`.
   *
   * Si no hay stock suficiente, `shortfallQuantity > 0` y el caller decide:
   * `consumeFefo` rechaza con BadRequestException; el preview simplemente
   * informa el faltante.
   */
  async planFefoConsumption(
    productId: string,
    branchId: string,
    quantity: number,
    salePriceUsd?: number,
  ): Promise<FefoConsumptionPlan> {
    if (!quantity || quantity <= 0) {
      throw new BadRequestException('La cantidad a consumir debe ser mayor que cero');
    }

    // Ordenar por vencimiento (más próximo primero), luego por createdAt para desempatar.
    const lots = await this.lotRepo
      .createQueryBuilder('lot')
      .where('lot.productId = :productId', { productId })
      .andWhere('lot.branchId = :branchId', { branchId })
      .andWhere("lot.status = 'available'")
      .andWhere('lot.quantityAvailable > 0')
      .andWhere('lot.expirationDate > :today', { today: new Date() })
      .orderBy('lot.expirationDate', 'ASC')
      .addOrderBy('lot.createdAt', 'ASC')
      .getMany();

    const lines: FefoConsumptionLine[] = [];
    let remaining = quantity;
    let totalCostUsd = 0;

    for (const lot of lots) {
      if (remaining <= 0) break;
      const available = Number(lot.quantityAvailable);
      if (available <= 0) continue;
      const take = Math.min(available, remaining);
      const unitCost = Number(lot.costUsd);
      const lineCost = +(unitCost * take).toFixed(4);
      lines.push({
        lotId: lot.id,
        lotNumber: lot.lotNumber,
        expirationDate: lot.expirationDate,
        unitCostUsd: unitCost,
        quantityToConsume: take,
        lineCostUsd: lineCost,
      });
      totalCostUsd += lineCost;
      remaining -= take;
    }

    const fulfilledQuantity = quantity - remaining;
    const shortfallQuantity = Math.max(0, remaining);
    const weightedAverageCostUsd = fulfilledQuantity > 0 ? +(totalCostUsd / fulfilledQuantity).toFixed(4) : 0;

    const plan: FefoConsumptionPlan = {
      productId,
      branchId,
      requestedQuantity: quantity,
      fulfilledQuantity,
      shortfallQuantity,
      totalCostUsd: +totalCostUsd.toFixed(4),
      weightedAverageCostUsd,
      lines,
    };

    if (salePriceUsd != null && salePriceUsd >= 0) {
      const grossRevenueUsd = +(salePriceUsd * fulfilledQuantity).toFixed(4);
      const marginUsd = +(grossRevenueUsd - plan.totalCostUsd).toFixed(4);
      const marginPct = grossRevenueUsd > 0 ? +((marginUsd / grossRevenueUsd) * 100).toFixed(2) : 0;
      plan.salePriceUsd = salePriceUsd;
      plan.grossRevenueUsd = grossRevenueUsd;
      plan.marginUsd = marginUsd;
      plan.marginPct = marginPct;
    }

    return plan;
  }

  /**
   * Preview del costo de venta. Wrapper sobre `planFefoConsumption` pensado
   * para ser consumido por un GET endpoint.
   */
  previewCostOfSale(dto: QueryCostOfSalePreviewDto, salePriceUsd?: number): Promise<FefoConsumptionPlan> {
    return this.planFefoConsumption(dto.productId, dto.branchId, Number(dto.quantity), salePriceUsd);
  }

  /**
   * Ejecuta el consumo FEFO de forma transaccional:
   *  1. Calcula el plan; si hay `shortfall > 0` rechaza (no hay stock).
   *  2. Por cada lote afectado: decrementa `quantity_available`,
   *     incrementa `quantity_sold` y guarda.
   *  3. Registra un asiento de kardex por cada lote (`movementType='sale_out'`)
   *     con `unit_cost_usd` del lote y `quantity` negativa.
   *  4. Retorna el plan completo (incluye COGS y margen si había `salePriceUsd`).
   */
  async consumeFefo(dto: ConsumeFefoDto, userId: string): Promise<FefoConsumptionPlan> {
    return this.dataSource.transaction(async (manager) => {
      // Planificar ANTES de consumir — usa repos del service pero la lectura es
      // consistente porque los locks los adquiriremos al hacer UPDATE.
      const plan = await this.planFefoConsumption(dto.productId, dto.branchId, dto.quantity, dto.salePriceUsd);

      if (plan.shortfallQuantity > 0) {
        throw new BadRequestException(
          `Stock insuficiente: solicitadas ${dto.quantity}, disponibles ${plan.fulfilledQuantity} (faltan ${plan.shortfallQuantity})`,
        );
      }

      // Balance post-consumo por (product, branch) — leer stock actual una vez.
      const stockRow = await manager
        .createQueryBuilder(InventoryLotEntity, 'lot')
        .select('COALESCE(SUM(lot.quantityAvailable), 0)', 'total')
        .where('lot.productId = :productId', { productId: dto.productId })
        .andWhere('lot.branchId = :branchId', { branchId: dto.branchId })
        .getRawOne<{ total: string }>();

      let runningBalance = Number(stockRow?.total ?? 0);

      for (const line of plan.lines) {
        // Lock + reread del lote para evitar race conditions con ventas concurrentes.
        const lot = await manager
          .getRepository(InventoryLotEntity)
          .createQueryBuilder('lot')
          .setLock('pessimistic_write')
          .where('lot.id = :id', { id: line.lotId })
          .getOne();

        if (!lot) throw new NotFoundException(`Lote ${line.lotId} no encontrado`);

        const available = Number(lot.quantityAvailable);
        if (available < line.quantityToConsume) {
          throw new BadRequestException(
            `Race condition: lote ${lot.lotNumber} ya no tiene stock suficiente (disponible ${available}, requerido ${line.quantityToConsume})`,
          );
        }

        lot.quantityAvailable = +(available - line.quantityToConsume).toFixed(3);
        lot.quantitySold = +(Number(lot.quantitySold) + line.quantityToConsume).toFixed(3);
        await manager.save(lot);

        runningBalance = +(runningBalance - line.quantityToConsume).toFixed(3);

        const kardex = manager.getRepository(KardexEntity).create({
          productId: dto.productId,
          branchId: dto.branchId,
          lotId: lot.id,
          movementType: 'sale_out',
          quantity: -line.quantityToConsume,
          unitCostUsd: line.unitCostUsd,
          balanceAfter: runningBalance,
          referenceType: dto.referenceType ?? 'sale',
          referenceId: dto.referenceId ?? null,
          notes: dto.notes ?? null,
          userId,
        });
        await manager.save(kardex);
      }

      return plan;
    });
  }

  /**
   * Revierte un consumo previo devolviendo mercancía a un lote específico.
   * - Decrementa `quantity_sold` (hasta 0 mínimo)
   * - Incrementa `quantity_returned` y `quantity_available`
   * - Crea asiento de kardex `movementType='return_in'` con `unit_cost_usd` del lote
   *
   * No permite devolver a lotes en cuarentena o vencidos (pedir re-ingreso manual).
   */
  async returnToLot(dto: ReturnToLotDto, userId: string): Promise<KardexEntity> {
    return this.dataSource.transaction(async (manager) => {
      const lot = await manager
        .getRepository(InventoryLotEntity)
        .createQueryBuilder('lot')
        .setLock('pessimistic_write')
        .where('lot.id = :id', { id: dto.lotId })
        .getOne();

      if (!lot) throw new NotFoundException('Lote no encontrado');

      if (lot.status !== 'available') {
        throw new BadRequestException(
          `No se puede devolver a un lote en estado '${lot.status}' — requiere ajuste manual`,
        );
      }
      if (new Date(lot.expirationDate).getTime() <= Date.now()) {
        throw new BadRequestException('No se puede devolver a un lote vencido');
      }

      const sold = Number(lot.quantitySold);
      if (sold < dto.quantity) {
        throw new BadRequestException(`Cantidad a devolver (${dto.quantity}) excede lo vendido del lote (${sold})`);
      }

      lot.quantitySold = +(sold - dto.quantity).toFixed(3);
      lot.quantityAvailable = +(Number(lot.quantityAvailable) + dto.quantity).toFixed(3);
      lot.quantityReturned = +(Number(lot.quantityReturned) + dto.quantity).toFixed(3);
      await manager.save(lot);

      const stockRow = await manager
        .createQueryBuilder(InventoryLotEntity, 'l')
        .select('COALESCE(SUM(l.quantityAvailable), 0)', 'total')
        .where('l.productId = :productId', { productId: lot.productId })
        .andWhere('l.branchId = :branchId', { branchId: lot.branchId })
        .getRawOne<{ total: string }>();

      const balanceAfter = Number(stockRow?.total ?? 0);

      const kardex = manager.getRepository(KardexEntity).create({
        productId: lot.productId,
        branchId: lot.branchId,
        lotId: lot.id,
        movementType: 'return_in',
        quantity: dto.quantity,
        unitCostUsd: Number(lot.costUsd),
        balanceAfter,
        referenceType: dto.referenceType ?? 'sale_return',
        referenceId: dto.referenceId ?? null,
        notes: dto.notes ?? null,
        userId,
      });

      return manager.save(kardex);
    });
  }

  async findKardex(
    query: QueryKardexDto,
  ): Promise<{ data: KardexEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.kardexRepo.createQueryBuilder('k');

    if (query.productId) {
      qb.andWhere('k.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('k.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.lotId) {
      qb.andWhere('k.lotId = :lotId', { lotId: query.lotId });
    }
    if (query.movementType) {
      qb.andWhere('k.movementType = :movementType', { movementType: query.movementType });
    }
    if (query.from) {
      qb.andWhere('k.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('k.createdAt <= :to', { to: new Date(query.to) });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('k.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async startCount(countId: string, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (count.status !== 'draft') {
      throw new BadRequestException(`No se puede iniciar una toma en estado '${count.status}'`);
    }

    return this.dataSource.transaction(async (manager) => {
      count.status = 'in_progress';
      count.startedAt = new Date();

      if (count.blocksSales) {
        const productIds = await manager
          .createQueryBuilder(InventoryCountItemEntity, 'item')
          .select('DISTINCT item.productId', 'productId')
          .where('item.countId = :countId', { countId })
          .getRawMany<{ productId: string }>();

        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: true })
            .whereInIds(productIds.map((p) => p.productId))
            .execute();
        }
        count.blockedAt = new Date();
      }

      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'in_progress', startedAt: count.startedAt, blockedAt: count.blockedAt },
        userId,
      });

      return saved;
    });
  }

  async recountCountItem(
    countId: string,
    itemId: string,
    dto: RecountItemDto,
    userId: string,
  ): Promise<InventoryCountItemEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['in_progress', 'completed'].includes(count.status)) {
      throw new BadRequestException(`No se puede recontar en estado '${count.status}'`);
    }

    const item = await this.countItemRepo.findOne({ where: { id: itemId, countId } });
    if (!item) throw new NotFoundException('Item de toma no encontrado');

    item.countedQuantity = null;
    item.countedLotNumber = null;
    item.countedExpirationDate = null;
    item.difference = null;
    item.differenceType = null;
    item.countedBy = null;
    item.countedAt = null;
    item.isRecounted = true;
    item.recountReason = dto.recountReason;

    const saved = await this.countItemRepo.save(item);

    if (count.status === 'completed') {
      count.status = 'in_progress';
      await this.countRepo.save(count);
    }

    await this.auditService.log({
      tableName: 'inventory_count_items',
      recordId: itemId,
      action: 'UPDATE',
      newValues: { isRecounted: true },
      justification: dto.recountReason,
      userId,
    });

    return saved;
  }

  async findCyclicSchedules(query: QueryCyclicScheduleDto): Promise<InventoryCyclicScheduleEntity[]> {
    const qb = this.cyclicScheduleRepo.createQueryBuilder('s');
    if (query.branchId) qb.andWhere('s.branchId = :branchId', { branchId: query.branchId });
    if (query.isActive !== undefined) qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    return qb.orderBy('s.createdAt', 'DESC').getMany();
  }

  async createCyclicSchedule(dto: CreateCyclicScheduleDto, userId: string): Promise<InventoryCyclicScheduleEntity> {
    const frequencyDays = dto.frequencyDays ?? 7;
    const schedule = this.cyclicScheduleRepo.create({
      branchId: dto.branchId,
      name: dto.name,
      abcClasses: dto.abcClasses,
      riskLevels: dto.riskLevels ?? null,
      frequencyDays,
      maxSkusPerCount: dto.maxSkusPerCount ?? 50,
      autoGenerate: dto.autoGenerate ?? true,
      isActive: dto.isActive ?? true,
      nextGenerationAt: this.addDays(new Date(), frequencyDays),
      createdBy: userId,
    });
    return this.cyclicScheduleRepo.save(schedule);
  }

  async updateCyclicSchedule(id: string, dto: UpdateCyclicScheduleDto): Promise<InventoryCyclicScheduleEntity> {
    const schedule = await this.cyclicScheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('Programa cíclico no encontrado');

    if (dto.branchId !== undefined) schedule.branchId = dto.branchId;
    if (dto.name !== undefined) schedule.name = dto.name;
    if (dto.abcClasses !== undefined) schedule.abcClasses = dto.abcClasses;
    if (dto.riskLevels !== undefined) schedule.riskLevels = dto.riskLevels;
    if (dto.frequencyDays !== undefined) schedule.frequencyDays = dto.frequencyDays;
    if (dto.maxSkusPerCount !== undefined) schedule.maxSkusPerCount = dto.maxSkusPerCount;
    if (dto.autoGenerate !== undefined) schedule.autoGenerate = dto.autoGenerate;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;

    return this.cyclicScheduleRepo.save(schedule);
  }

  async getAccuracy(query: QueryAccuracyDto): Promise<{
    avgAccuracyPct: number;
    totalCounts: number;
    totalAdjustments: number;
    trend: Array<{ date: string; accuracyPct: number }>;
  }> {
    const qb = this.countRepo
      .createQueryBuilder('c')
      .where("c.status = 'approved'")
      .andWhere('c.accuracyPct IS NOT NULL');

    if (query.branchId) qb.andWhere('c.branchId = :branchId', { branchId: query.branchId });
    if (query.from) qb.andWhere('c.completedAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('c.completedAt <= :to', { to: new Date(query.to) });

    const counts = await qb.orderBy('c.completedAt', 'ASC').getMany();

    const totalCounts = counts.length;
    const avgAccuracyPct =
      totalCounts === 0
        ? 0
        : Number((counts.reduce((sum, c) => sum + Number(c.accuracyPct ?? 0), 0) / totalCounts).toFixed(2));

    const totalAdjustments = counts.reduce(
      (sum, c) => sum + Number(c.totalSkusOver ?? 0) + Number(c.totalSkusShort ?? 0),
      0,
    );

    const trend = counts.map((c) => ({
      date: (c.completedAt ?? c.createdAt).toISOString().slice(0, 10),
      accuracyPct: Number(c.accuracyPct ?? 0),
    }));

    return { avgAccuracyPct, totalCounts, totalAdjustments, trend };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async createCount(dto: CreateInventoryCountDto, userId: string): Promise<InventoryCountWithItems> {
    if (dto.countType === 'cycle' && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException('Una toma cíclica requiere al menos un productId');
    }
    if (
      dto.countType === 'partial' &&
      !dto.categoryId &&
      !dto.locationId &&
      (!dto.productIds || dto.productIds.length === 0)
    ) {
      throw new BadRequestException(
        'Una toma parcial requiere al menos un filtro (categoryId, locationId o productIds)',
      );
    }

    const lotsQb = this.lotRepo
      .createQueryBuilder('lot')
      .where('lot.branchId = :branchId', { branchId: dto.branchId })
      .andWhere("lot.status IN ('available', 'quarantine')");

    if (dto.locationId) {
      lotsQb.andWhere('lot.locationId = :locationId', { locationId: dto.locationId });
    }

    let productIdFilter = dto.productIds;
    if (dto.countType !== 'full' && dto.categoryId) {
      const products = await this.productRepo.find({
        where: { categoryId: dto.categoryId },
        select: ['id'],
      });
      const categoryProductIds = products.map((p) => p.id);
      productIdFilter = productIdFilter
        ? productIdFilter.filter((id) => categoryProductIds.includes(id))
        : categoryProductIds;
      if (productIdFilter.length === 0) {
        throw new BadRequestException('No hay productos en la categoría para contar');
      }
    }

    if (productIdFilter && productIdFilter.length > 0) {
      lotsQb.andWhere('lot.productId IN (:...productIds)', { productIds: productIdFilter });
    }

    const lots = await lotsQb.getMany();
    if (lots.length === 0) {
      throw new BadRequestException('No se encontraron lotes para generar la toma');
    }

    const countNumber = await this.generateCountNumber();

    return this.dataSource.transaction(async (manager) => {
      const count = manager.create(InventoryCountEntity, {
        branchId: dto.branchId,
        countNumber,
        countType: dto.countType,
        status: 'draft',
        countDate: new Date(),
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedCount = await manager.save(count);

      const items = lots.map((lot) =>
        manager.create(InventoryCountItemEntity, {
          countId: savedCount.id,
          productId: lot.productId,
          lotId: lot.id,
          locationId: lot.locationId ?? null,
          expectedQuantity: Number(lot.quantityAvailable),
          expectedLotNumber: lot.lotNumber,
          expectedExpirationDate: lot.expirationDate,
          systemQuantity: Number(lot.quantityAvailable),
          countedQuantity: null,
          difference: null,
        }),
      );
      const savedItems = await manager.save(items);

      savedCount.totalSkusExpected = savedItems.length;
      await manager.save(savedCount);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: savedCount.id,
        action: 'INSERT',
        newValues: { ...savedCount, itemCount: savedItems.length },
        userId,
      });

      return Object.assign(savedCount, { items: savedItems });
    });
  }

  async findAllCounts(
    query: QueryInventoryCountDto,
  ): Promise<{ data: InventoryCountEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.countRepo.createQueryBuilder('c');
    if (query.branchId) qb.andWhere('c.branchId = :branchId', { branchId: query.branchId });
    if (query.countType) qb.andWhere('c.countType = :countType', { countType: query.countType });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneCount(id: string): Promise<InventoryCountWithItems> {
    const count = await this.countRepo.findOne({ where: { id } });
    if (!count) throw new NotFoundException('Toma de inventario no encontrada');
    const items = await this.countItemRepo.find({ where: { countId: id } });
    return Object.assign(count, { items });
  }

  async updateCountItem(
    countId: string,
    itemId: string,
    dto: CountItemUpdateDto,
    userId: string,
  ): Promise<InventoryCountItemEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['draft', 'in_progress'].includes(count.status)) {
      throw new BadRequestException(`No se pueden modificar items en estado '${count.status}'`);
    }

    const item = await this.countItemRepo.findOne({ where: { id: itemId, countId } });
    if (!item) throw new NotFoundException('Item de toma no encontrado');

    item.countedQuantity = dto.countedQuantity;
    const diff = Number((dto.countedQuantity - Number(item.systemQuantity)).toFixed(3));
    item.difference = diff;
    item.differenceType = diff === 0 ? 'match' : diff > 0 ? 'over' : 'short';
    item.countedBy = userId;
    item.countedAt = new Date();
    const saved = await this.countItemRepo.save(item);

    if (count.status === 'draft') {
      count.status = 'in_progress';
      await this.countRepo.save(count);
    }

    return saved;
  }

  async bulkUpdateCountItems(
    countId: string,
    dto: BulkUpdateCountItemsDto,
    userId: string,
  ): Promise<InventoryCountItemEntity[]> {
    const results: InventoryCountItemEntity[] = [];
    for (const entry of dto.items) {
      results.push(
        await this.updateCountItem(countId, entry.itemId, { countedQuantity: entry.countedQuantity }, userId),
      );
    }
    return results;
  }

  async completeCount(countId: string, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['draft', 'in_progress'].includes(count.status)) {
      throw new BadRequestException(`No se puede completar una toma en estado '${count.status}'`);
    }

    const pending = await this.countItemRepo.count({ where: { countId, countedQuantity: IsNull() } });
    if (pending > 0) {
      throw new BadRequestException(`Aún faltan ${pending} items por contar`);
    }

    const items = await this.countItemRepo.find({ where: { countId } });
    const matched = items.filter((i) => i.differenceType === 'match').length;
    const over = items.filter((i) => i.differenceType === 'over').length;
    const short = items.filter((i) => i.differenceType === 'short').length;
    const counted = items.length;

    count.status = 'completed';
    count.completedAt = new Date();
    count.totalSkusCounted = counted;
    count.totalSkusMatched = matched;
    count.totalSkusOver = over;
    count.totalSkusShort = short;
    count.accuracyPct = counted === 0 ? 0 : Number(((matched / counted) * 100).toFixed(2));
    const saved = await this.countRepo.save(count);

    await this.auditService.log({
      tableName: 'inventory_counts',
      recordId: count.id,
      action: 'UPDATE',
      newValues: {
        status: 'completed',
        totalSkusMatched: matched,
        totalSkusOver: over,
        totalSkusShort: short,
        accuracyPct: count.accuracyPct,
      },
      userId,
    });

    return saved;
  }

  async approveCount(countId: string, dto: ApproveCountDto, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (count.status !== 'completed') {
      throw new BadRequestException('Solo se pueden aprobar tomas en estado completed');
    }

    const items = await this.countItemRepo.find({ where: { countId } });

    return this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        const diff = Number(item.difference ?? 0);
        if (diff === 0 || !item.lotId) continue;

        const lot = await manager.findOne(InventoryLotEntity, { where: { id: item.lotId } });
        if (!lot) continue;

        const newAvailable = Number(lot.quantityAvailable) + diff;
        if (newAvailable < 0) {
          throw new BadRequestException(`Lote ${lot.lotNumber}: ajuste resultaría en cantidad negativa`);
        }
        lot.quantityAvailable = newAvailable;
        await manager.save(lot);

        const balanceRow = await manager
          .createQueryBuilder(InventoryLotEntity, 'lot')
          .select('SUM(lot.quantityAvailable)', 'total')
          .where('lot.productId = :productId', { productId: item.productId })
          .andWhere('lot.branchId = :branchId', { branchId: count.branchId })
          .getRawOne();

        const kardex = manager.create(KardexEntity, {
          productId: item.productId,
          branchId: count.branchId,
          lotId: item.lotId,
          movementType: diff > 0 ? 'adjustment_in' : 'adjustment_out',
          quantity: diff,
          balanceAfter: parseFloat(balanceRow?.total) || 0,
          referenceType: 'inventory_count',
          referenceId: count.id,
          notes: `Ajuste por toma ${count.countNumber} (${count.countType}): ${dto.justification}`,
          userId,
        });
        await manager.save(kardex);
      }

      count.status = 'approved';
      count.approvedBy = userId;
      count.approvedAt = new Date();

      if (count.blocksSales && count.blockedAt && !count.unblockedAt) {
        const productIds = items.map((i) => i.productId);
        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: false })
            .whereInIds(productIds)
            .execute();
        }
        count.unblockedAt = new Date();
      }

      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'approved', approvedBy: userId },
        justification: dto.justification,
        userId,
      });

      return saved;
    });
  }

  async cancelCount(countId: string, dto: CancelCountDto, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (['approved', 'cancelled'].includes(count.status)) {
      throw new BadRequestException(`No se puede cancelar una toma en estado '${count.status}'`);
    }

    return this.dataSource.transaction(async (manager) => {
      count.status = 'cancelled';

      if (count.blocksSales && count.blockedAt && !count.unblockedAt) {
        const items = await manager.find(InventoryCountItemEntity, { where: { countId } });
        const productIds = items.map((i) => i.productId);
        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: false })
            .whereInIds(productIds)
            .execute();
        }
        count.unblockedAt = new Date();
      }

      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'cancelled' },
        justification: dto.reason,
        userId,
      });

      return saved;
    });
  }

  private async generateCountNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `IC-${year}-`;
    const last = await this.countRepo
      .createQueryBuilder('c')
      .where('c.countNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.countNumber', 'DESC')
      .getOne();
    const nextSeq = last ? parseInt(last.countNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private addExpirySignal(lot: InventoryLotEntity): ExpirySignalLot {
    const today = new Date();
    const expDate = new Date(lot.expirationDate);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let expirySignal: 'EXPIRED' | 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
    if (diffDays <= 0) {
      expirySignal = 'EXPIRED';
    } else if (diffDays <= 30) {
      expirySignal = 'RED';
    } else if (diffDays <= 60) {
      expirySignal = 'YELLOW';
    } else if (diffDays <= 90) {
      expirySignal = 'ORANGE';
    } else {
      expirySignal = 'GREEN';
    }

    return { ...lot, expirySignal };
  }

  /**
   * Crea un asiento de kardex. IMPORTANTE: los callers deben haber aplicado
   * y persistido el cambio de `quantity_available` ANTES de llamar a este
   * helper — `balance_after` se lee directamente como SUM(quantity_available)
   * del producto/sucursal, que ya refleja el delta.
   *
   * Si se llama sin haber persistido aún el cambio, `balance_after` quedará
   * una unidad "atrasada".
   */
  private async createKardexEntry(data: {
    productId: string;
    branchId: string;
    lotId?: string;
    movementType: string;
    quantity: number;
    unitCostUsd?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    userId: string;
    terminalId?: string;
  }): Promise<KardexEntity> {
    const currentStock = await this.lotRepo
      .createQueryBuilder('lot')
      .select('COALESCE(SUM(lot.quantityAvailable), 0)', 'total')
      .where('lot.productId = :productId', { productId: data.productId })
      .andWhere('lot.branchId = :branchId', { branchId: data.branchId })
      .getRawOne<{ total: string }>();

    const balanceAfter = parseFloat(currentStock?.total ?? '0') || 0;

    const kardex = this.kardexRepo.create({
      ...data,
      lotId: data.lotId || null,
      balanceAfter,
    });

    return this.kardexRepo.save(kardex);
  }
}
