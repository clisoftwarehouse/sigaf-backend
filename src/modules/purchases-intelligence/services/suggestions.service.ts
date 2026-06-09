import { In, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { ENGINE_PARAMS } from '../engine/engine-params';
import { ComparatorService } from './comparator.service';
import { ClassificationsService } from './classifications.service';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { ProductClassificationEntity } from '../infrastructure/persistence/relational/entities/product-classification.entity';
import { PurchaseOrderEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/purchase-order.entity';
import { PurchaseOrderItemEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/purchase-order-item.entity';

export type SuggestionDecision =
  | 'buy_urgent'
  | 'buy'
  | 'buy_moderate'
  | 'no_buy'
  | 'review'
  | 'dynamize_candidate'
  | 'decode_candidate'
  | 'blocked_expiry';

export type SuggestionItem = {
  productId: string;
  productName: string;
  abcdClass: 'A' | 'B' | 'C' | 'D';
  isPareto: boolean;
  score: number;
  currentStock: number;
  dailyVelocity: number;
  daysOfInventory: number | null;
  coverageDays: number;
  idealQuantity: number;
  suggestedQuantity: number;
  decision: SuggestionDecision;
  reason: string;
  expirySignal: string | null;
  bestSupplier?: {
    supplierId: string;
    supplierName: string;
    netCostUsd: number;
    score: number;
  } | null;
  estimatedCostUsd?: number;
};

export type SuggestionRun = {
  branchId: string;
  generatedAt: string;
  itemsCount: number;
  totalEstimatedUsd: number;
  items: SuggestionItem[];
};

export type CreateOrdersFromSuggestionsDto = {
  branchId: string;
  suggestions: Array<{
    productId: string;
    quantity: number;
    supplierId: string;
    netCostUsd: number;
    decision: SuggestionDecision;
    reason: string;
  }>;
  notes?: string;
};

/**
 * Genera el sugerido de compra para una sucursal a partir de las
 * clasificaciones ABCD vigentes. NO persiste el sugerido (recorte
 * 2026-05-28: el snapshot se calcula on-demand). El operador edita en
 * UI y, si decide, crea las OCs.
 *
 * Reglas:
 *   - Vencimiento ≤ 90 días → bloqueo total (decision = 'blocked_expiry')
 *   - Stock cubre coverage_days_for_class → no_buy
 *   - Caso normal → suggestedQty = (coverage_days * dailyVelocity) - stock
 *   - Comparador interno (5 dim) decide la mejor droguería
 *   - Si no hay candidatos → review (operador resuelve manual)
 */
@Injectable()
export class SuggestionsService {
  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(PurchaseOrderEntity)
    private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private readonly orderItemRepo: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(ProductClassificationEntity)
    private readonly classRepo: Repository<ProductClassificationEntity>,
    private readonly classificationsService: ClassificationsService,
    private readonly comparatorService: ComparatorService,
  ) {}

  async generate(
    branchId: string,
    filters?: { abcd?: Array<'A' | 'B' | 'C' | 'D'>; budgetUsd?: number },
  ): Promise<SuggestionRun> {
    const branch = await this.branchRepo.findOne({ where: { id: branchId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    const classifications = await this.classificationsService.findByBranch(branchId);
    if (classifications.length === 0) {
      return {
        branchId,
        generatedAt: new Date().toISOString(),
        itemsCount: 0,
        totalEstimatedUsd: 0,
        items: [],
      };
    }

    const productIds = classifications.map((c) => c.productId);
    const products = await this.productRepo.find({ where: { id: In(productIds) } });
    const productById = new Map(products.map((p) => [p.id, p]));

    const items: SuggestionItem[] = [];
    let runningBudget = filters?.budgetUsd ?? Infinity;

    for (const cls of classifications) {
      if (filters?.abcd && !filters.abcd.includes(cls.abcdClass)) continue;
      const product = productById.get(cls.productId);
      if (!product) continue;

      const dailyVelocity = Number(cls.dailyVelocity) || 0;
      const daysOfInventory = cls.daysOfInventory == null ? null : Number(cls.daysOfInventory);
      const currentStock =
        dailyVelocity > 0 && daysOfInventory != null ? Math.round(dailyVelocity * daysOfInventory * 100) / 100 : 0;

      const coverageDays = ENGINE_PARAMS.COVERAGE_DAYS[cls.abcdClass as keyof typeof ENGINE_PARAMS.COVERAGE_DAYS] ?? 30;
      const idealQty = Math.max(0, dailyVelocity * coverageDays);
      const remainder = idealQty - currentStock;

      // Bloqueo por vencimiento próximo.
      if (cls.expirySignal === 'RED' || cls.expirySignal === 'EXPIRED') {
        items.push({
          productId: cls.productId,
          productName: product.description ?? cls.productId,
          abcdClass: cls.abcdClass,
          isPareto: cls.isPareto,
          score: Number(cls.score) || 0,
          currentStock,
          dailyVelocity,
          daysOfInventory,
          coverageDays,
          idealQuantity: round2(idealQty),
          suggestedQuantity: 0,
          decision: 'blocked_expiry',
          reason: 'Vencimiento próximo o vencido — no recomprar hasta liquidar stock actual.',
          expirySignal: cls.expirySignal,
          bestSupplier: null,
          estimatedCostUsd: 0,
        });
        continue;
      }

      // Stock suficiente: no comprar.
      if (remainder <= 0) {
        let decision: SuggestionDecision = 'no_buy';
        let reason = `Stock cubre ${coverageDays} días de cobertura. No recomprar todavía.`;

        // Si es C de baja rotación o D, marcamos como candidato a gestión.
        if (cls.abcdClass === 'C' && dailyVelocity < 0.1) {
          decision = 'dynamize_candidate';
          reason = 'Categoría C con baja rotación — candidato a dinamizar (negociar con laboratorio).';
        } else if (cls.abcdClass === 'D') {
          decision = 'decode_candidate';
          reason = 'Categoría D — candidato a descodificar del catálogo si no se mueve en próximos meses.';
        }

        items.push({
          productId: cls.productId,
          productName: product.description ?? cls.productId,
          abcdClass: cls.abcdClass,
          isPareto: cls.isPareto,
          score: Number(cls.score) || 0,
          currentStock,
          dailyVelocity,
          daysOfInventory,
          coverageDays,
          idealQuantity: round2(idealQty),
          suggestedQuantity: 0,
          decision,
          reason,
          expirySignal: cls.expirySignal,
          bestSupplier: null,
          estimatedCostUsd: 0,
        });
        continue;
      }

      // Hay que comprar — usar el comparador interno.
      let suggestedQty = Math.ceil(remainder);
      let bestSupplier: SuggestionItem['bestSupplier'] = null;
      let estimatedCost = 0;
      let decision: SuggestionDecision;
      let reason: string;

      try {
        const compResult = await this.comparatorService.compareForProduct(cls.productId, suggestedQty);
        if (compResult.candidates.length > 0) {
          const best = compResult.candidates[0];
          bestSupplier = {
            supplierId: best.supplierId,
            supplierName: best.supplierName,
            netCostUsd: best.netCostUsd,
            score: best.score,
          };
          estimatedCost = best.netCostUsd * suggestedQty;

          // Recortar por presupuesto disponible.
          if (estimatedCost > runningBudget) {
            const affordableQty = Math.floor(runningBudget / best.netCostUsd);
            if (affordableQty > 0) {
              suggestedQty = affordableQty;
              estimatedCost = best.netCostUsd * suggestedQty;
            } else {
              suggestedQty = 0;
            }
          }
          runningBudget = Math.max(0, runningBudget - estimatedCost);

          if (suggestedQty <= 0) {
            decision = 'review';
            reason = 'Presupuesto agotado — revisar prioridades antes de cerrar.';
          } else {
            decision = cls.abcdClass === 'A' ? 'buy_urgent' : cls.abcdClass === 'B' ? 'buy' : 'buy_moderate';
            reason = `Cubrir ${coverageDays} días de cobertura para clase ${cls.abcdClass}. Mejor droguería: ${best.supplierName} (score ${best.score}).`;
          }
        } else {
          decision = 'review';
          reason = 'Sin droguería registrada con stock disponible para este producto. Cargar oferta antes de comprar.';
        }
      } catch {
        decision = 'review';
        reason = 'No fue posible computar el comparador. Revisar manualmente.';
      }

      items.push({
        productId: cls.productId,
        productName: product.description ?? cls.productId,
        abcdClass: cls.abcdClass,
        isPareto: cls.isPareto,
        score: Number(cls.score) || 0,
        currentStock,
        dailyVelocity,
        daysOfInventory,
        coverageDays,
        idealQuantity: round2(idealQty),
        suggestedQuantity: suggestedQty,
        decision,
        reason,
        expirySignal: cls.expirySignal,
        bestSupplier,
        estimatedCostUsd: round2(estimatedCost),
      });
    }

    const totalEstimatedUsd = round2(items.reduce((s, i) => s + (i.estimatedCostUsd ?? 0), 0));

    return {
      branchId,
      generatedAt: new Date().toISOString(),
      itemsCount: items.length,
      totalEstimatedUsd,
      items,
    };
  }

  /**
   * Crea OCs agrupadas por droguería a partir de las sugerencias seleccionadas.
   * Cada droguería recibe UNA sola OC con todos sus items, persistiendo el
   * snapshot del motor (decisión, motivo, costo neto al momento) en las
   * nuevas columnas de purchase_order_items.
   */
  async createOrdersFromSuggestions(
    dto: CreateOrdersFromSuggestionsDto,
    userId: string,
  ): Promise<Array<{ orderId: string; orderNumber: string; supplierId: string; itemsCount: number }>> {
    if (!dto.suggestions || dto.suggestions.length === 0) {
      throw new BadRequestException('No hay sugerencias para convertir en OC');
    }

    const branch = await this.branchRepo.findOne({ where: { id: dto.branchId } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');

    // Agrupar por supplierId.
    const bySupplier = new Map<string, typeof dto.suggestions>();
    for (const s of dto.suggestions) {
      if (s.quantity <= 0) continue;
      const list = bySupplier.get(s.supplierId) ?? [];
      list.push(s);
      bySupplier.set(s.supplierId, list);
    }

    if (bySupplier.size === 0) {
      throw new BadRequestException('Todas las sugerencias tienen cantidad cero.');
    }

    const results: Array<{ orderId: string; orderNumber: string; supplierId: string; itemsCount: number }> = [];

    for (const [supplierId, suggestions] of bySupplier.entries()) {
      const orderNumber = this.generateOrderNumber();
      const subtotal = suggestions.reduce((s, x) => s + x.netCostUsd * x.quantity, 0);

      const order = this.orderRepo.create({
        branchId: dto.branchId,
        supplierId,
        orderNumber,
        status: 'draft',
        orderDate: new Date(),
        subtotalUsd: round4(subtotal),
        totalUsd: round4(subtotal),
        notes: dto.notes ?? `Generada desde sugerido del motor (Compras Intelligence).`,
        createdBy: userId,
      } as Partial<PurchaseOrderEntity>);
      const savedOrder = await this.orderRepo.save(order);

      const items = suggestions.map((s) =>
        this.orderItemRepo.create({
          orderId: savedOrder.id,
          productId: s.productId,
          quantity: s.quantity,
          unitCostUsd: s.netCostUsd,
          discountPct: 0,
          subtotalUsd: round4(s.netCostUsd * s.quantity),
          decisionAtCreation: s.decision,
          reasonAtCreation: s.reason,
          netCostUsdSnapshot: s.netCostUsd,
        }),
      );
      await this.orderItemRepo.save(items);

      results.push({
        orderId: savedOrder.id,
        orderNumber: savedOrder.orderNumber ?? orderNumber,
        supplierId,
        itemsCount: items.length,
      });
    }

    return results;
  }

  private generateOrderNumber(): string {
    const d = new Date();
    const yyyymmdd =
      d.getUTCFullYear().toString() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `OC-${yyyymmdd}-${rand}`;
  }
}

function round2(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}
function round4(n: number): number {
  return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : 0;
}
