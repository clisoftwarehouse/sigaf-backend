import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';
import {
  monthRange,
  periodLabel,
  type LibroResumen,
  isContribuyenteRif,
  type LibroVentasRow,
  type LibroVentasResult,
} from './libros-iva.types';

/**
 * Construye el Libro de Ventas del IVA para un período mensual.
 *
 * Fuente: `sale_tickets` finalizados del mes. Cada ticket es una operación.
 * Las devoluciones (`type='return'`) se registran como notas de crédito
 * que restan del total.
 *
 * IMPORTANTE (caveat HKA): mientras el POS emita tickets no-fiscales, este
 * libro registra TODAS las ventas igual. Cuando HKA esté operativo, las
 * ventas tendrán número de control fiscal real. Hoy el control_number
 * queda en el `control_number` del ticket si existe, o null.
 */
@Injectable()
export class LibroVentasService {
  constructor(
    @InjectRepository(SaleTicketEntity)
    private readonly ticketRepo: Repository<SaleTicketEntity>,
  ) {}

  async generate(year: number, month: number, branchId?: string): Promise<LibroVentasResult> {
    const { start, end } = monthRange(year, month);

    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.customer', 'c')
      .where('t.createdAt >= :start', { start })
      .andWhere('t.createdAt < :end', { end })
      .andWhere('t.status = :status', { status: 'finalized' })
      .orderBy('t.createdAt', 'ASC')
      .addOrderBy('t.ticketNumber', 'ASC');

    if (branchId) qb.andWhere('t.branchId = :branchId', { branchId });

    const tickets = await qb.getMany();

    const rows: LibroVentasRow[] = [];
    let byFiscalMachineUsd = 0;
    let byElectronicMeansUsd = 0;
    let contribuyentesUsd = 0;
    let noContribuyentesUsd = 0;

    for (const t of tickets) {
      const isReturn = t.type === 'return';
      const sign = isReturn ? -1 : 1;

      const exemptUsd = sign * (Number(t.subtotalExemptUsd) || 0);
      const taxableBaseUsd = sign * (Number(t.subtotalTaxableUsd) || 0);
      const vatUsd = sign * (Number(t.vatAmountUsd) || 0);
      const totalUsd = sign * (Number(t.totalUsd) || 0);
      const totalBs = sign * (Number(t.totalBs) || 0);
      const exchangeRate = Number(t.exchangeRateUsdBs) || 0;

      const customerRif = t.customer ? `${t.customer.documentType}-${t.customer.documentNumber}` : null;
      const isContribuyente = isContribuyenteRif(customerRif);

      // Sin HKA todavía: asumimos medios electrónicos. Cuando el ticket
      // tenga control_number fiscal (HKA), lo tratamos como máquina fiscal.
      const byFiscalMachine = !!t.controlNumber;

      if (byFiscalMachine) byFiscalMachineUsd += totalUsd;
      else byElectronicMeansUsd += totalUsd;
      if (isContribuyente) contribuyentesUsd += totalUsd;
      else noContribuyentesUsd += totalUsd;

      rows.push({
        date: toDateStr(t.createdAt),
        documentKind: isReturn ? 'credit_note' : 'invoice',
        documentNumber: t.controlNumber ?? t.provisionalNumber ?? String(t.ticketNumber),
        controlNumber: t.controlNumber,
        customerRif,
        customerName: t.customer?.fullName ?? 'CONSUMIDOR FINAL',
        totalUsd: round2(totalUsd),
        totalBs: round2(totalBs),
        exemptUsd: round2(exemptUsd),
        taxableBaseUsd: round2(taxableBaseUsd),
        vatUsd: round2(vatUsd),
        exchangeRate,
        byFiscalMachine,
        isContribuyente,
      });
    }

    const resumen = summarize(rows);

    return {
      period: { year, month, label: periodLabel(year, month) },
      branchId: branchId ?? null,
      rows,
      resumen,
      breakdown: {
        byFiscalMachineUsd: round2(byFiscalMachineUsd),
        byElectronicMeansUsd: round2(byElectronicMeansUsd),
        contribuyentesUsd: round2(contribuyentesUsd),
        noContribuyentesUsd: round2(noContribuyentesUsd),
      },
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
