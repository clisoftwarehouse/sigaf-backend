import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, LessThanOrEqual } from 'typeorm';

import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { GoodsReceiptEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';
import { ExchangeRateEntity } from '@/modules/exchange-rates/infrastructure/persistence/relational/entities/exchange-rate.entity';
import {
  monthRange,
  periodLabel,
  summarizeRows,
  type LibroComprasRow,
  type LibroComprasResult,
} from './libros-iva.types';

/** Alícuota general del IVA vigente en Venezuela (16%). Ver investigación SENIAT. */
const IVA_RATE = 0.16;

/**
 * Construye el Libro de Compras del IVA para un período mensual.
 *
 * Fuente: `goods_receipts` del mes con factura de proveedor. Cada recepción
 * aprobada (no en reaprobación pendiente) es una operación de compra.
 *
 * Validación Art. 57 LIVA: para que el IVA soportado genere crédito fiscal,
 * la factura del proveedor debe tener número de factura, número de control
 * y RIF del proveedor, con el IVA desglosado. Si falta algo, marcamos
 * `generatesCredit=false` y sumamos a `nonDeductibleVatUsd`.
 */
@Injectable()
export class LibroComprasService {
  constructor(
    @InjectRepository(GoodsReceiptEntity)
    private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(ExchangeRateEntity)
    private readonly rateRepo: Repository<ExchangeRateEntity>,
  ) {}

  /**
   * Resuelve la tasa BCV USD→VES vigente en una fecha. Busca la tasa BCV
   * con effective_date más reciente en o antes de la fecha dada. Devuelve
   * null si no hay ninguna (no se puede convertir → libro lo deja en 0).
   *
   * IMPORTANTE: solo tasas source='BCV'. El SENIAT exige la tasa oficial
   * del BCV, no tasas paralelas ni de reposición.
   */
  private async bcvRateForDate(dateStr: string): Promise<number | null> {
    const row = await this.rateRepo.findOne({
      where: {
        source: 'BCV',
        currencyFrom: 'USD',
        currencyTo: 'VES',
        effectiveDate: LessThanOrEqual(dateStr as unknown as Date),
      },
      order: { effectiveDate: 'DESC' },
    });
    return row ? Number(row.rate) || null : null;
  }

  async generate(year: number, month: number, branchId?: string): Promise<LibroComprasResult> {
    const { start, end } = monthRange(year, month);

    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .where('r.receiptDate >= :start', { start })
      .andWhere('r.receiptDate < :end', { end })
      .andWhere('r.requiresReapproval = false')
      // SENIAT: la mercancía en consignación NO es una compra hasta que se
      // liquida — no genera crédito fiscal. Solo entran recepciones de tipo
      // 'purchase' al libro de compras.
      .andWhere('r.receiptType = :rt', { rt: 'purchase' })
      .orderBy('r.receiptDate', 'ASC')
      .addOrderBy('r.receiptNumber', 'ASC');

    if (branchId) qb.andWhere('r.branchId = :branchId', { branchId });

    const receipts = await qb.getMany();

    // Cargar suppliers en una query (GoodsReceiptEntity no define relación).
    const supplierIds = Array.from(new Set(receipts.map((r) => r.supplierId)));
    const suppliers = supplierIds.length ? await this.supplierRepo.findBy({ id: In(supplierIds) }) : [];
    const supplierById = new Map(suppliers.map((s) => [s.id, s]));

    const rows: LibroComprasRow[] = [];
    let nonDeductibleVatUsd = 0;

    for (const r of receipts) {
      const supplier = supplierById.get(r.supplierId);
      const vatUsd = Number(r.taxUsd) || 0;
      const igtfUsd = Number(r.igtfUsd) || 0;

      // CRÍTICO (SENIAT): el total de la operación en el libro de IVA excluye
      // el IGTF (no es parte de la Ley del IVA). El ticket suma IGTF en su
      // totalUsd, así que lo restamos para el libro.
      const totalUsd = Math.max(0, (Number(r.totalUsd) || 0) - igtfUsd);

      // Base imponible gravable: la derivamos del IVA al 16% para que sea
      // 100% consistente con el crédito fiscal declarado. base = IVA / 0.16.
      const taxableBaseUsd = vatUsd > 0 ? round2(vatUsd / IVA_RATE) : 0;

      // Exentas = total de la operación − base gravable − IVA. Lo restante
      // del total que no fue gravado son medicamentos / productos exentos.
      const exemptUsd = Math.max(0, round2(totalUsd - taxableBaseUsd - vatUsd));

      const dateStr = toDateStr(r.receiptDate);
      const isVes = r.nativeCurrency === 'VES';

      // Tasa BCV para convertir a Bs. Factura VES → usa la tasa congelada
      // en la recepción. Factura USD → busca la tasa BCV oficial del día.
      let exchangeRate: number | null = null;
      if (isVes && r.exchangeRateUsed) {
        exchangeRate = Number(r.exchangeRateUsed) || null;
      } else {
        exchangeRate = await this.bcvRateForDate(dateStr);
      }

      const rate = exchangeRate ?? 0;
      // Derivamos TODOS los montos Bs con la misma tasa para que la fila
      // cuadre (exentas + base + IVA = total) y excluya el IGTF. No usamos
      // nativeTotal directo porque podría incluir IGTF de la factura física.
      const exemptBs = exemptUsd * rate;
      const taxableBaseBs = taxableBaseUsd * rate;
      const vatBs = vatUsd * rate;
      const totalBs = totalUsd * rate;

      // ─── Validación de cumplimiento Art. 57 ───────────────────────────
      const warnings: string[] = [];
      if (!r.supplierInvoiceNumber) warnings.push('Falta número de factura');
      if (!r.supplierControlNumber) warnings.push('Falta número de control');
      if (!supplier?.rif) warnings.push('Falta RIF del proveedor');
      if (vatUsd > 0 && taxableBaseUsd <= 0) {
        warnings.push('IVA sin base imponible desglosada');
      }
      const generatesCredit = warnings.length === 0;
      if (!generatesCredit) nonDeductibleVatUsd += vatUsd;

      rows.push({
        date: dateStr,
        documentKind: 'invoice',
        documentNumber: r.supplierInvoiceNumber,
        controlNumber: r.supplierControlNumber,
        supplierRif: supplier?.rif ?? '—',
        supplierName: supplier?.businessName ?? supplier?.tradeName ?? '—',
        exchangeRate,
        exemptBs: round2(exemptBs),
        taxableBaseBs: round2(taxableBaseBs),
        vatBs: round2(vatBs),
        totalBs: round2(totalBs),
        exemptUsd,
        taxableBaseUsd: round2(taxableBaseUsd),
        vatUsd: round2(vatUsd),
        totalUsd: round2(totalUsd),
        generatesCredit,
        complianceWarnings: warnings,
      });
    }

    const resumen = summarizeRows(rows);

    return {
      period: { year, month, label: periodLabel(year, month) },
      branchId: branchId ?? null,
      rows,
      resumen,
      nonDeductibleVatUsd: round2(nonDeductibleVatUsd),
    };
  }
}

function toDateStr(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
