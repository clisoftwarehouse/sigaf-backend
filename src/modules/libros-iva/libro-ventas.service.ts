import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';
import {
  monthRange,
  periodLabel,
  summarizeRows,
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

      const exchangeRate = Number(t.exchangeRateUsdBs) || 0;
      const exemptUsd = sign * (Number(t.subtotalExemptUsd) || 0);
      const taxableBaseUsd = sign * (Number(t.subtotalTaxableUsd) || 0);
      const vatUsd = sign * (Number(t.vatAmountUsd) || 0);

      // CRÍTICO (SENIAT): el total de la operación en el libro de IVA es
      // base exenta + base gravable + IVA. El IGTF NO forma parte de la Ley
      // del IVA, así que se EXCLUYE del total del libro aunque el ticket lo
      // sume en su totalUsd. Por eso NO usamos t.totalUsd ni t.totalBs
      // (ambos incluyen IGTF) — derivamos el total limpio acá.
      const totalUsd = exemptUsd + taxableBaseUsd + vatUsd;

      // Conversión a Bs con la tasa BCV del día de la venta (congelada en
      // el ticket). Derivamos cada monto con la misma tasa para que el
      // libro cuadre fila por fila y excluya el IGTF.
      const exemptBs = exemptUsd * exchangeRate;
      const taxableBaseBs = taxableBaseUsd * exchangeRate;
      const vatBs = vatUsd * exchangeRate;
      const totalBs = totalUsd * exchangeRate;

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
        exchangeRate,
        exemptBs: round2(exemptBs),
        taxableBaseBs: round2(taxableBaseBs),
        vatBs: round2(vatBs),
        totalBs: round2(totalBs),
        exemptUsd: round2(exemptUsd),
        taxableBaseUsd: round2(taxableBaseUsd),
        vatUsd: round2(vatUsd),
        totalUsd: round2(totalUsd),
        byFiscalMachine,
        isContribuyente,
      });
    }

    const resumen = summarizeRows(rows);

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

function toDateStr(d: Date | string): string {
  const date = d instanceof Date ? d : new Date(d);
  return date.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}
