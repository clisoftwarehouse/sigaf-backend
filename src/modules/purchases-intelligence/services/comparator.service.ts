import { In, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { calculateNetCost, type NetCostBreakdown } from '../engine/net-cost.calculator';
import { scoreComparator, type ComparatorScoredCandidate } from '../engine/comparator.scorer';
import { LabConditionEntity } from '../infrastructure/persistence/relational/entities/lab-condition.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { DrugstoreConditionEntity } from '../infrastructure/persistence/relational/entities/drugstore-condition.entity';
import { SupplierProductEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier-product.entity';

export type ComparatorResult = {
  productId: string;
  productName: string;
  quantity: number;
  candidates: Array<
    ComparatorScoredCandidate & {
      netCostBreakdown: NetCostBreakdown;
      reasonsApplied: string[];
    }
  >;
};

/**
 * Servicio que orquesta:
 *   1. Carga los `supplier_products` activos del producto solicitado.
 *   2. Para cada droguería resuelve la condición aplicable (más específica
 *      gana: producto > brand > droguería general).
 *   3. Carga la condición de laboratorio del brand del producto.
 *   4. Llama al engine puro `calculateNetCost` para los 3 escenarios.
 *   5. Pasa todos los candidatos al `scoreComparator` (5 dim).
 *   6. Devuelve la lista ordenada con score 0-100.
 *
 * El engine NO importa nada de TypeORM. Este service hace todo el I/O y
 * pasa POJOs al motor. Si en el futuro necesitamos otra fuente de datos
 * (caché, API externa), solo cambia este service.
 */
@Injectable()
export class ComparatorService {
  constructor(
    @InjectRepository(SupplierProductEntity)
    private readonly supplierProductRepo: Repository<SupplierProductEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(DrugstoreConditionEntity)
    private readonly drugstoreRepo: Repository<DrugstoreConditionEntity>,
    @InjectRepository(LabConditionEntity)
    private readonly labRepo: Repository<LabConditionEntity>,
  ) {}

  /**
   * Compara droguerías para un producto y cantidad dada.
   *
   * Si no hay candidatos (ningún supplier_product activo), devuelve la
   * lista vacía — el operador en UI ve "sin oferta registrada para este
   * producto" en vez de un error.
   */
  async compareForProduct(productId: string, quantity: number): Promise<ComparatorResult> {
    const product = await this.productRepo.findOne({ where: { id: productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const supplierProducts = await this.supplierProductRepo.find({
      where: { productId, isAvailable: true },
    });

    if (supplierProducts.length === 0) {
      return {
        productId,
        productName: product.description ?? productId,
        quantity,
        candidates: [],
      };
    }

    const supplierIds = supplierProducts.map((sp) => sp.supplierId);
    const suppliers = await this.supplierRepo.findBy({ id: In(supplierIds) });
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));

    const brandId = product.brandId ?? null;

    // Condiciones por droguería para este producto / su brand / generales.
    const drugstoreConditions = await this.drugstoreRepo.find({
      where: { supplierId: In(supplierIds), isActive: true },
    });

    // Condición de laboratorio del brand (si aplica).
    const labConditions = brandId ? await this.labRepo.find({ where: { brandId, isActive: true } }) : [];

    const asOf = new Date();
    const candidates = supplierProducts.map((sp) => {
      const supplier = supplierById.get(sp.supplierId);
      const dc = this.resolveDrugstoreCondition(drugstoreConditions, sp.supplierId, productId, brandId);
      const lc = this.resolveLabCondition(labConditions, sp.supplierId, productId);

      const breakdown = calculateNetCost({
        basePriceUsd: Number(sp.costUsd) || 0,
        drugstoreCondition: dc
          ? {
              cabeceraPct: Number(dc.cabeceraPct) || 0,
              volumenPct: Number(dc.volumenPct) || 0,
              prontoPagoPct: Number(dc.prontoPagoPct) || 0,
              volumenMinUsd: dc.volumenMinUsd != null ? Number(dc.volumenMinUsd) : null,
              volumenMinUnits: dc.volumenMinUnits != null ? Number(dc.volumenMinUnits) : null,
            }
          : null,
        labCondition: lc
          ? {
              linealPct: Number(lc.linealPct) || 0,
              escalaPct: Number(lc.escalaPct) || 0,
              escalaMinUnits: lc.escalaMinUnits != null ? Number(lc.escalaMinUnits) : null,
            }
          : null,
        // Sin contexto de compra global todavía. Asumimos el item solo.
        totalPurchaseUsd: (Number(sp.costUsd) || 0) * quantity,
        totalUnits: quantity,
      });

      const reasons: string[] = [];
      if (breakdown.appliedDiscounts.cabeceraPct > 0) {
        reasons.push(`Cabecera droguería ${breakdown.appliedDiscounts.cabeceraPct}%`);
      }
      if (breakdown.appliedDiscounts.linealPct > 0) {
        reasons.push(`Lineal laboratorio ${breakdown.appliedDiscounts.linealPct}%`);
      }
      if (breakdown.appliedDiscounts.volumenPct > 0) {
        reasons.push(`Volumen ${breakdown.appliedDiscounts.volumenPct}%`);
      }
      if (breakdown.appliedDiscounts.escalaPct > 0) {
        reasons.push(`Escala ${breakdown.appliedDiscounts.escalaPct}%`);
      }

      return {
        supplierId: sp.supplierId,
        supplierName: supplier?.tradeName ?? supplier?.businessName ?? sp.supplierId,
        netCostUsd: breakdown.commercial,
        availableQty: sp.availableQty != null ? Number(sp.availableQty) : null,
        lotExpiryDate: sp.lotExpiryDate ?? null,
        creditDays: dc?.creditDays ?? null,
        deliveryDays: dc?.deliveryDays ?? null,
        netCostBreakdown: breakdown,
        reasonsApplied: reasons,
      };
    });

    const scored = scoreComparator({
      productId,
      quantity,
      candidates: candidates.map((c) => ({
        supplierId: c.supplierId,
        supplierName: c.supplierName,
        netCostUsd: c.netCostUsd,
        availableQty: c.availableQty,
        lotExpiryDate: c.lotExpiryDate,
        creditDays: c.creditDays,
        deliveryDays: c.deliveryDays,
      })),
      asOf,
    });

    // Mergear el score con el breakdown completo manteniendo el orden
    // del scorer (por score desc).
    const breakdownBySupplier = new Map(candidates.map((c) => [c.supplierId, c] as const));

    return {
      productId,
      productName: product.description ?? productId,
      quantity,
      candidates: scored.map((s) => {
        const extra = breakdownBySupplier.get(s.supplierId);
        return {
          ...s,
          netCostBreakdown: extra?.netCostBreakdown ?? {
            basePriceUsd: s.netCostUsd,
            appliedDiscounts: {
              cabeceraPct: 0,
              linealPct: 0,
              volumenPct: 0,
              escalaPct: 0,
              prontoPagoPct: 0,
            },
            conservative: s.netCostUsd,
            commercial: s.netCostUsd,
            financial: s.netCostUsd,
          },
          reasonsApplied: extra?.reasonsApplied ?? [],
        };
      }),
    };
  }

  /**
   * Resuelve la condición de droguería más específica:
   *   1. Para este supplier + product específico
   *   2. Para este supplier + brand del producto
   *   3. Para este supplier general (product=null, brand=null)
   *
   * Devuelve null si ninguna match (no hay descuento configurado).
   */
  private resolveDrugstoreCondition(
    conditions: DrugstoreConditionEntity[],
    supplierId: string,
    productId: string,
    brandId: string | null,
  ): DrugstoreConditionEntity | null {
    const ofSupplier = conditions.filter((c) => c.supplierId === supplierId);
    if (ofSupplier.length === 0) return null;

    const byProduct = ofSupplier.find((c) => c.productId === productId);
    if (byProduct) return byProduct;

    if (brandId) {
      const byBrand = ofSupplier.find((c) => c.brandId === brandId && c.productId == null);
      if (byBrand) return byBrand;
    }

    const general = ofSupplier.find((c) => c.productId == null && c.brandId == null);
    return general ?? null;
  }

  /**
   * Resuelve la condición de laboratorio más específica:
   *   1. Para este brand + supplier + product
   *   2. Para este brand + supplier (sin product)
   *   3. Para este brand + product (sin supplier)
   *   4. Para este brand general (sin supplier, sin product)
   */
  private resolveLabCondition(
    conditions: LabConditionEntity[],
    supplierId: string,
    productId: string,
  ): LabConditionEntity | null {
    if (conditions.length === 0) return null;

    const exact = conditions.find((c) => c.supplierId === supplierId && c.productId === productId);
    if (exact) return exact;

    const supplierLevel = conditions.find((c) => c.supplierId === supplierId && c.productId == null);
    if (supplierLevel) return supplierLevel;

    const productLevel = conditions.find((c) => c.productId === productId && c.supplierId == null);
    if (productLevel) return productLevel;

    // El IsNull import sigue importado por si en el futuro queremos hacer
    // matches específicos por DB; acá filtramos en memoria.
    void IsNull;
    return conditions.find((c) => c.supplierId == null && c.productId == null) ?? null;
  }
}
