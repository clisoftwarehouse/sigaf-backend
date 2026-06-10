/**
 * Tipos compartidos de los Libros de IVA (Ventas y Compras).
 *
 * Estructura conforme a Providencia SNAT/2011/00071 + Reglamento LIVA
 * Arts. 76-78. Ver investigación SENIAT (memory).
 *
 * Notas de cumplimiento aplicadas:
 *  - Alícuota general 16% (no hay 8% reducida activa por decreto vigente).
 *  - Alícuota adicional 5%-25% sobre pagos en divisas — se registra en
 *    columna aparte cuando aplica.
 *  - IGTF NO va en el libro de IVA (no es parte de la Ley del IVA).
 *  - Medicamentos = exentos → van a la columna "exentas".
 *  - Tipo de cambio del día del hecho imponible (Art. 25 LIVA).
 *  - Notas de crédito se registran como líneas negativas que restan del
 *    total del mes.
 */

export type DocumentKind =
  | 'invoice' // Factura / ticket fiscal
  | 'credit_note' // Nota de crédito (resta)
  | 'debit_note'; // Nota de débito (suma)

/** Una fila del Libro de Ventas (una operación facturada). */
export type LibroVentasRow = {
  date: string; // YYYY-MM-DD
  documentKind: DocumentKind;
  documentNumber: string;
  controlNumber: string | null;
  customerRif: string | null;
  customerName: string;
  /** Total de la operación (incluye IVA). */
  totalUsd: number;
  totalBs: number;
  /** Operaciones exentas / no gravadas. */
  exemptUsd: number;
  /** Base imponible gravada con alícuota general (16%). */
  taxableBaseUsd: number;
  /** IVA débito fiscal de la alícuota general. */
  vatUsd: number;
  /** Tipo de cambio aplicado el día de la operación. */
  exchangeRate: number;
  /** true si la venta fue por máquina fiscal, false si medio electrónico. */
  byFiscalMachine: boolean;
  /** true si el cliente es contribuyente (tiene RIF J/G), false si CF. */
  isContribuyente: boolean;
};

/** Una fila del Libro de Compras (una factura de proveedor). */
export type LibroComprasRow = {
  date: string;
  documentKind: DocumentKind;
  documentNumber: string | null;
  controlNumber: string | null;
  supplierRif: string;
  supplierName: string;
  totalUsd: number;
  totalBs: number;
  exemptUsd: number;
  taxableBaseUsd: number;
  vatUsd: number; // crédito fiscal
  exchangeRate: number | null;
  /** true si la factura cumple Art. 57 (tiene control number + RIF + IVA). */
  generatesCredit: boolean;
  /** Razones por las que NO genera crédito fiscal, si aplica. */
  complianceWarnings: string[];
};

export type LibroResumen = {
  totalOperations: number;
  totalExemptUsd: number;
  totalTaxableBaseUsd: number;
  totalVatUsd: number;
  totalUsd: number;
  totalBs: number;
};

export type LibroVentasResult = {
  period: { year: number; month: number; label: string };
  branchId: string | null;
  rows: LibroVentasRow[];
  resumen: LibroResumen;
  /** Desglose adicional exigido por SENIAT. */
  breakdown: {
    byFiscalMachineUsd: number;
    byElectronicMeansUsd: number;
    contribuyentesUsd: number;
    noContribuyentesUsd: number;
  };
};

export type LibroComprasResult = {
  period: { year: number; month: number; label: string };
  branchId: string | null;
  rows: LibroComprasRow[];
  resumen: LibroResumen;
  /** Crédito fiscal que NO se puede deducir por incumplimiento Art. 57. */
  nonDeductibleVatUsd: number;
};

const MONTH_LABELS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

export function periodLabel(year: number, month: number): string {
  return `${MONTH_LABELS[month - 1] ?? month} ${year}`;
}

/** Rango [inicio, fin) del mes en UTC para queries por fecha. */
export function monthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0));
  return { start, end };
}

/**
 * Un RIF de contribuyente empieza con J (jurídico), G (gobierno) o C
 * (consejo comunal). V/E suelen ser consumidores finales (personas
 * naturales no contribuyentes formales del IVA).
 */
export function isContribuyenteRif(rif: string | null | undefined): boolean {
  if (!rif) return false;
  const prefix = rif.trim().charAt(0).toUpperCase();
  return prefix === 'J' || prefix === 'G' || prefix === 'C';
}
