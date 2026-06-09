import { ENGINE_PARAMS } from './engine-params';

/**
 * Calcula rotación de un producto desde su histórico de ventas.
 *
 *   daily_velocity = unidades vendidas en ventana / días de la ventana
 *   days_of_inventory = stock actual / daily_velocity
 *   days_since_last_sale = días desde la última venta
 *
 * Ventana default: ROTATION_WINDOW_DAYS (90 días, PRD §9.1.1).
 *
 * Pure function. Sin I/O, sin Repositories.
 */

export type SaleEntry = {
  /** Fecha del movimiento de venta. */
  date: Date;
  /** Unidades vendidas (positivo). Si tu fuente tiene devoluciones, restalas antes de pasar. */
  quantity: number;
};

export type RotationInput = {
  /** Ventas históricas del producto. No es necesario que vengan ordenadas. */
  sales: SaleEntry[];
  /** Stock actual del producto en la sucursal evaluada. */
  currentStock: number;
  /** Ventana en días. Default `ENGINE_PARAMS.ROTATION_WINDOW_DAYS`. */
  windowDays?: number;
  /** Fecha "hoy" — inyectable para tests determinísticos. Default `new Date()`. */
  asOf?: Date;
};

export type RotationOutput = {
  /** Promedio unidades/día en la ventana. */
  dailyVelocity: number;
  /** Días que dura el stock actual si la velocidad se mantiene. `Infinity` si velocity=0. */
  daysOfInventory: number;
  /** Días desde la última venta. `null` si nunca se vendió. */
  daysSinceLastSale: number | null;
  /** Cantidad total vendida dentro de la ventana — útil para Pareto. */
  unitsSoldInWindow: number;
};

export function calculateRotation(input: RotationInput): RotationOutput {
  const asOf = input.asOf ?? new Date();
  const windowDays = input.windowDays ?? ENGINE_PARAMS.ROTATION_WINDOW_DAYS;
  const sales = input.sales ?? [];
  const stock = Math.max(0, Number(input.currentStock) || 0);

  const windowStart = new Date(asOf);
  windowStart.setDate(windowStart.getDate() - windowDays);

  let unitsInWindow = 0;
  let lastSaleAt: Date | null = null;
  for (const entry of sales) {
    const d = entry.date instanceof Date ? entry.date : new Date(entry.date);
    if (!Number.isFinite(d.getTime())) continue;
    const qty = Number(entry.quantity) || 0;
    if (qty <= 0) continue;

    if (d >= windowStart && d <= asOf) {
      unitsInWindow += qty;
    }
    if (!lastSaleAt || d > lastSaleAt) {
      lastSaleAt = d;
    }
  }

  const dailyVelocity = windowDays > 0 ? unitsInWindow / windowDays : 0;
  const daysOfInventory = dailyVelocity > 0 ? stock / dailyVelocity : stock > 0 ? Infinity : 0;
  const daysSinceLastSale =
    lastSaleAt != null ? Math.max(0, Math.floor((asOf.getTime() - lastSaleAt.getTime()) / 86400000)) : null;

  return {
    dailyVelocity: round4(dailyVelocity),
    daysOfInventory: Number.isFinite(daysOfInventory) ? round2(daysOfInventory) : daysOfInventory,
    daysSinceLastSale,
    unitsSoldInWindow: unitsInWindow,
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
