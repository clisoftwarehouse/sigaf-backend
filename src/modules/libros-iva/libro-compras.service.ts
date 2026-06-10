import { In, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { GoodsReceiptEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';
import {
  monthRange,
  periodLabel,
  type LibroResumen,
  type LibroComprasRow,
  type LibroComprasResult,
} from './libros-iva.types';

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
  ) {}

  async generate(year: number, month: number, branchId?: string): Promise<LibroComprasResult> {
    const { start, end } = monthRange(year, month);

    const qb = this.receiptRepo
      .createQueryBuilder('r')
      .where('r.receiptDate >= :start', { start })
      .andWhere('r.receiptDate < :end', { end })
      .andWhere('r.requiresReapproval = false')
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
      const taxableBaseUsd = Number(r.subtotalUsd) || 0;
      const vatUsd = Number(r.taxUsd) || 0;
      const totalUsd = Number(r.totalUsd) || 0;
      // exentas = total - base gravada - iva. Si el producto es exento el
      // backend lo metió en subtotal sin IVA; computamos el remanente como
      // exento para que el libro cuadre fila por fila.
      const exemptUsd = Math.max(0, round2(totalUsd - taxableBaseUsd - vatUsd));

      const isVes = r.nativeCurrency === 'VES';
      const totalBs = isVes ? Number(r.nativeTotal) || 0 : 0;
      const exchangeRate = isVes && r.exchangeRateUsed ? Number(r.exchangeRateUsed) : null;

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
        date: toDateStr(r.receiptDate),
        documentKind: 'invoice',
        documentNumber: r.supplierInvoiceNumber,
        controlNumber: r.supplierControlNumber,
        supplierRif: supplier?.rif ?? '—',
        supplierName: supplier?.businessName ?? supplier?.tradeName ?? '—',
        totalUsd: round2(totalUsd),
        totalBs: round2(totalBs),
        exemptUsd,
        taxableBaseUsd: round2(taxableBaseUsd),
        vatUsd: round2(vatUsd),
        exchangeRate,
        generatesCredit,
        complianceWarnings: warnings,
      });
    }

    const resumen = summarize(rows);

    return {
      period: { year, month, label: periodLabel(year, month) },
      branchId: branchId ?? null,
      rows,
      resumen,
      nonDeductibleVatUsd: round2(nonDeductibleVatUsd),
    };
  }
}

function summarize(
  rows: Array<{ exemptUsd: number; taxableBaseUsd: number; vatUsd: number; totalUsd: number; totalBs: number }>,
): LibroResumen {
  return rows.reduce<LibroResumen>(
    (acc, r) => ({
      totalOperations: acc.totalOperations + 1,
      totalExemptUsd: round2(acc.totalExemptUsd + r.exemptUsd),
      totalTaxableBaseUsd: round2(acc.totalTaxableBaseUsd + r.taxableBaseUsd),
      totalVatUsd: round2(acc.totalVatUsd + r.vatUsd),
      totalUsd: round2(acc.totalUsd + r.totalUsd),
      totalBs: round2(acc.totalBs + r.totalBs),
    }),
    {
      totalOperations: 0,
      totalExemptUsd: 0,
      totalTaxableBaseUsd: 0,
      totalVatUsd: 0,
      totalUsd: 0,
      totalBs: 0,
    },
  );
}

function toDateStr(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
