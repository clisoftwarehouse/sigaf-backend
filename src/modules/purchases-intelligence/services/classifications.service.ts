import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { ENGINE_PARAMS } from '../engine/engine-params';
import { calculatePareto } from '../engine/pareto.calculator';
import { calculateRotation } from '../engine/rotation.calculator';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { ProductClassificationEntity } from '../infrastructure/persistence/relational/entities/product-classification.entity';

/**
 * Computa el ABCD vigente para todos los productos de una sucursal.
 *
 * Fuentes de datos:
 *   - kardex (movement_type='sale') últimos 90 días → rotación + margen
 *   - inventory_lots activos → stock + costo + sale price + vencimiento
 *   - products → catálogo base
 *
 * El motor (engine/*) es puro. Acá hacemos I/O y armamos los inputs.
 * Después persistimos el snapshot vigente en product_classifications
 * (una sola fila por producto+sucursal — se sobrescribe).
 */
@Injectable()
export class ClassificationsService {
  constructor(
    @InjectRepository(ProductClassificationEntity)
    private readonly classRepo: Repository<ProductClassificationEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
  ) {}

  /**
   * Recalcula el ABCD para todos los productos activos en una sucursal.
   *
   * Devuelve un resumen con la cantidad de productos clasificados en cada
   * categoría, no la lista completa (eso lo pide el portafolio).
   */
  async recalculate(branchId: string): Promise<{
    branchId: string;
    totalProducts: number;
    distribution: { A: number; B: number; C: number; D: number };
    paretoCount: number;
    forcedPromotions: number;
    calculatedAt: string;
  }> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    const asOf = new Date();
    const windowStart = new Date(asOf);
    windowStart.setDate(windowStart.getDate() - ENGINE_PARAMS.ROTATION_WINDOW_DAYS);

    // 1) Cargar productos activos + sus lotes + sus ventas en la ventana.
    const products = await this.productRepo.find({ where: { isActive: true } });

    const lots = await this.lotRepo
      .createQueryBuilder('lot')
      .where('lot.branchId = :branchId', { branchId })
      .andWhere('lot.status = :status', { status: 'available' })
      .getMany();

    const salesRows = await this.kardexRepo
      .createQueryBuilder('k')
      .select('k.productId', 'productId')
      .addSelect('SUM(ABS(k.quantity))', 'unitsSold')
      .addSelect('MAX(k.createdAt)', 'lastSaleAt')
      .where('k.branchId = :branchId', { branchId })
      .andWhere('k.movementType = :movementType', { movementType: 'sale' })
      .andWhere('k.createdAt >= :start', { start: windowStart })
      .groupBy('k.productId')
      .getRawMany<{ productId: string; unitsSold: string; lastSaleAt: Date }>();

    const salesByProduct = new Map<string, { unitsSold: number; lastSaleAt: Date | null }>();
    for (const r of salesRows) {
      salesByProduct.set(r.productId, {
        unitsSold: Number(r.unitsSold) || 0,
        lastSaleAt: r.lastSaleAt ? new Date(r.lastSaleAt) : null,
      });
    }

    // 2) Pre-agregar lots por producto: stock total + nearest expiration +
    //    avg cost + avg sale price.
    type LotAgg = {
      totalStock: number;
      avgCost: number;
      avgSalePrice: number;
      nearestExpiry: Date | null;
    };
    const lotAggByProduct = new Map<string, LotAgg>();
    for (const lot of lots) {
      const productId = lot.productId;
      const qty = Number(lot.quantityAvailable) || 0;
      const cost = Number(lot.costUsd) || 0;
      const sale = Number(lot.salePrice) || 0;
      const expiry = lot.expirationDate instanceof Date ? lot.expirationDate : new Date(lot.expirationDate);

      const current = lotAggByProduct.get(productId) ?? {
        totalStock: 0,
        avgCost: 0,
        avgSalePrice: 0,
        nearestExpiry: null,
      };
      // weighted avg by qty
      const newTotal = current.totalStock + qty;
      current.avgCost = newTotal > 0 ? (current.avgCost * current.totalStock + cost * qty) / newTotal : 0;
      current.avgSalePrice = newTotal > 0 ? (current.avgSalePrice * current.totalStock + sale * qty) / newTotal : 0;
      current.totalStock = newTotal;
      if (!current.nearestExpiry || expiry < current.nearestExpiry) {
        current.nearestExpiry = expiry;
      }
      lotAggByProduct.set(productId, current);
    }

    // 3) Computar Pareto: necesitamos units + margen por producto.
    const paretoInput = products.map((p) => {
      const sales = salesByProduct.get(p.id);
      const agg = lotAggByProduct.get(p.id);
      const unitsSold = sales?.unitsSold ?? 0;
      const marginPerUnit = agg && agg.avgSalePrice > 0 && agg.avgCost > 0 ? agg.avgSalePrice - agg.avgCost : 0;
      const marginUsd = unitsSold * marginPerUnit;
      return { productId: p.id, unitsSold, marginUsd };
    });
    const paretoResults = calculatePareto(paretoInput);
    const paretoMap = new Map(paretoResults.map((p) => [p.productId, p]));

    // 4) Por cada producto: armar componentes del score, clasificar, persistir.
    const distribution = { A: 0, B: 0, C: 0, D: 0 };
    let paretoCount = 0;
    let forcedPromotions = 0;

    const upserts: Partial<ProductClassificationEntity>[] = [];

    for (const product of products) {
      const sales = salesByProduct.get(product.id) ?? { unitsSold: 0, lastSaleAt: null };
      const agg = lotAggByProduct.get(product.id) ?? {
        totalStock: 0,
        avgCost: 0,
        avgSalePrice: 0,
        nearestExpiry: null,
      };
      const pareto = paretoMap.get(product.id) ?? { isPareto: false, paretoScore: 0 };

      const rotation = calculateRotation({
        sales: sales.lastSaleAt ? [{ date: sales.lastSaleAt, quantity: sales.unitsSold }] : [],
        currentStock: agg.totalStock,
        asOf,
        windowDays: ENGINE_PARAMS.ROTATION_WINDOW_DAYS,
      });
      // Override velocity con el valor real ya que arriba solo pasamos 1 entrada agregada.
      rotation.dailyVelocity = sales.unitsSold > 0 ? sales.unitsSold / ENGINE_PARAMS.ROTATION_WINDOW_DAYS : 0;
      rotation.daysOfInventory =
        rotation.dailyVelocity > 0 ? agg.totalStock / rotation.dailyVelocity : agg.totalStock > 0 ? Infinity : 0;

      // ─── Componente: rotación ────────────────────────────────────
      // Normalizo daily_velocity contra el máximo del set para tener 0-1.
      // Si no hay ventas, queda 0.
      const maxVelocity = Math.max(...paretoInput.map((p) => p.unitsSold / ENGINE_PARAMS.ROTATION_WINDOW_DAYS));
      const componentRotation = maxVelocity > 0 ? Math.min(1, rotation.dailyVelocity / maxVelocity) : 0;

      // ─── Componente: Pareto ──────────────────────────────────────
      const componentPareto = pareto.paretoScore;

      // ─── Componente: margen ──────────────────────────────────────
      const marginPct = agg.avgSalePrice > 0 ? ((agg.avgSalePrice - agg.avgCost) / agg.avgSalePrice) * 100 : 0;
      const componentMargin =
        marginPct >= ENGINE_PARAMS.MARGIN_HEALTHY_PCT
          ? 1
          : marginPct <= ENGINE_PARAMS.MARGIN_MIN_PCT
            ? 0
            : (marginPct - ENGINE_PARAMS.MARGIN_MIN_PCT) /
              (ENGINE_PARAMS.MARGIN_HEALTHY_PCT - ENGINE_PARAMS.MARGIN_MIN_PCT);

      // ─── Componente: días de inventario ──────────────────────────
      // Penaliza tanto el quiebre (días bajos) como el sobrestock (días altos).
      let componentInventoryDays: number;
      if (rotation.daysOfInventory === Infinity || rotation.daysOfInventory === 0) {
        componentInventoryDays = 0;
      } else if (rotation.daysOfInventory <= ENGINE_PARAMS.INVENTORY_DAYS_COMFORTABLE) {
        componentInventoryDays = 1;
      } else if (rotation.daysOfInventory <= ENGINE_PARAMS.INVENTORY_DAYS_ACCEPTABLE) {
        componentInventoryDays =
          1 -
          (rotation.daysOfInventory - ENGINE_PARAMS.INVENTORY_DAYS_COMFORTABLE) /
            (ENGINE_PARAMS.INVENTORY_DAYS_ACCEPTABLE - ENGINE_PARAMS.INVENTORY_DAYS_COMFORTABLE);
      } else {
        componentInventoryDays = 0;
      }

      // ─── Componente: vencimiento ─────────────────────────────────
      let componentExpiry = 0.5;
      let expirySignal: string | null = null;
      if (agg.nearestExpiry) {
        const daysToExpiry = Math.floor((agg.nearestExpiry.getTime() - asOf.getTime()) / 86400000);
        if (daysToExpiry <= 0) {
          componentExpiry = 0;
          expirySignal = 'EXPIRED';
        } else if (daysToExpiry <= ENGINE_PARAMS.EXPIRY_BLOCK_DAYS) {
          componentExpiry = 0;
          expirySignal = 'RED';
        } else if (daysToExpiry <= ENGINE_PARAMS.EXPIRY_HEALTHY_DAYS) {
          componentExpiry =
            (daysToExpiry - ENGINE_PARAMS.EXPIRY_BLOCK_DAYS) /
            (ENGINE_PARAMS.EXPIRY_HEALTHY_DAYS - ENGINE_PARAMS.EXPIRY_BLOCK_DAYS);
          expirySignal = 'YELLOW';
        } else {
          componentExpiry = 1;
          expirySignal = 'GREEN';
        }
      }

      // ─── Score 0-100 ─────────────────────────────────────────────
      const w = ENGINE_PARAMS.SCORE_WEIGHTS;
      const score =
        100 *
        (w.rotation * componentRotation +
          w.pareto * componentPareto +
          w.margin * componentMargin +
          w.inventoryDays * componentInventoryDays +
          w.expiry * componentExpiry);

      let abcdClass: 'A' | 'B' | 'C' | 'D';
      if (score >= ENGINE_PARAMS.ABCD_THRESHOLDS.A) abcdClass = 'A';
      else if (score >= ENGINE_PARAMS.ABCD_THRESHOLDS.B) abcdClass = 'B';
      else if (score >= ENGINE_PARAMS.ABCD_THRESHOLDS.C) abcdClass = 'C';
      else abcdClass = 'D';

      // Regla dura: C + Pareto → ascenso forzado a B.
      let forcedPromotionToB = false;
      if (abcdClass === 'C' && pareto.isPareto) {
        abcdClass = 'B';
        forcedPromotionToB = true;
        forcedPromotions++;
      }

      distribution[abcdClass]++;
      if (pareto.isPareto) paretoCount++;

      upserts.push({
        productId: product.id,
        branchId,
        abcdClass,
        score: round2(score),
        isPareto: pareto.isPareto,
        forcedPromotionToB,
        dailyVelocity: round4(rotation.dailyVelocity),
        daysOfInventory: Number.isFinite(rotation.daysOfInventory) ? round2(rotation.daysOfInventory) : null,
        daysSinceLastSale: sales.lastSaleAt
          ? Math.max(0, Math.floor((asOf.getTime() - sales.lastSaleAt.getTime()) / 86400000))
          : null,
        marginPct: round2(marginPct),
        expirySignal,
        componentRotation: round3(componentRotation),
        componentPareto: round3(componentPareto),
        componentMargin: round3(componentMargin),
        componentInventoryDays: round3(componentInventoryDays),
        componentExpiry: round3(componentExpiry),
        calculatedAt: asOf,
      });
    }

    // 5) Upsert masivo (delete + insert para simplicidad — el snapshot
    // vigente se sobrescribe entero).
    await this.classRepo.delete({ branchId });
    if (upserts.length > 0) {
      // Chunkear para evitar parámetros excesivos en pg.
      const CHUNK = 200;
      for (let i = 0; i < upserts.length; i += CHUNK) {
        await this.classRepo.save(upserts.slice(i, i + CHUNK) as ProductClassificationEntity[]);
      }
    }

    return {
      branchId,
      totalProducts: products.length,
      distribution,
      paretoCount,
      forcedPromotions,
      calculatedAt: asOf.toISOString(),
    };
  }

  /**
   * Lista las clasificaciones vigentes del portafolio para una sucursal.
   * Filtra por clase si se indica.
   */
  async findByBranch(
    branchId: string,
    filters?: { abcd?: 'A' | 'B' | 'C' | 'D'; isPareto?: boolean },
  ): Promise<ProductClassificationEntity[]> {
    const where: Record<string, unknown> = { branchId };
    if (filters?.abcd) where.abcdClass = filters.abcd;
    if (filters?.isPareto !== undefined) where.isPareto = filters.isPareto;
    return this.classRepo.find({ where, order: { score: 'DESC' } });
  }

  async findOne(productId: string, branchId: string): Promise<ProductClassificationEntity | null> {
    return this.classRepo.findOne({ where: { productId, branchId } });
  }
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function round3(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : 0;
}
function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}
