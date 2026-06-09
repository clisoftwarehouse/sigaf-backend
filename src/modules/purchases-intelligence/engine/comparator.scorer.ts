import { ENGINE_PARAMS } from './engine-params';

/**
 * Comparador de droguerías para UN producto y UNA cantidad deseada.
 *
 * Cada candidato (oferta de una droguería) recibe un score 0-100 ponderando
 * 5 dimensiones (PRD §9.2):
 *
 *   - costo (50%)        — el más barato gana 1, los demás escalan inversamente
 *   - disponibilidad (15%) — cubre la cantidad deseada?
 *   - vencimiento (15%)  — qué tan lejos vence el lote ofrecido
 *   - crédito (10%)      — más días de crédito = mejor
 *   - entrega (10%)      — menos días de entrega = mejor
 *
 * Output ordenado descendente por score (el #1 es el ganador). Caller
 * decide si forzar la opción del motor o ajustarla en la UI.
 *
 * Pure function: sin Repositories, sin Date.now() (asOf inyectable).
 */

export type ComparatorCandidate = {
  supplierId: string;
  supplierName: string;
  /** Costo neto USD que ya pasó por el `net-cost.calculator`. */
  netCostUsd: number;
  /** Cantidad disponible en la droguería. `null` = desconocido (se penaliza). */
  availableQty: number | null;
  /** Fecha de vencimiento del lote ofrecido. `null` = desconocido (se penaliza). */
  lotExpiryDate: Date | null;
  /** Días de crédito que ofrece. `null` = pago contado. */
  creditDays: number | null;
  /** Días de entrega comprometidos. `null` = desconocido (se penaliza). */
  deliveryDays: number | null;
};

export type ComparatorInput = {
  productId: string;
  /** Cantidad deseada de unidades. */
  quantity: number;
  candidates: ComparatorCandidate[];
  /** Fecha "hoy" — inyectable para tests. Default `new Date()`. */
  asOf?: Date;
};

export type ComparatorScoredCandidate = ComparatorCandidate & {
  rank: number;
  score: number;
  components: {
    cost: number;
    availability: number;
    expiry: number;
    credit: number;
    delivery: number;
  };
};

export function scoreComparator(input: ComparatorInput): ComparatorScoredCandidate[] {
  const candidates = input.candidates ?? [];
  if (candidates.length === 0) return [];

  const asOf = input.asOf ?? new Date();
  const quantity = Math.max(0, Number(input.quantity) || 0);

  // ─── Costo: 1 al más barato, escala inversa para el resto ──────────
  const costs = candidates.map((c) => Math.max(0, Number(c.netCostUsd) || 0));
  const minCost = Math.min(...costs.filter((c) => c > 0));
  const computeCost = (c: number) => {
    if (!Number.isFinite(c) || c <= 0) return 0;
    if (!Number.isFinite(minCost) || minCost <= 0) return 0;
    // Inverso normalizado: el más barato vale 1, los más caros menos.
    return Math.max(0, Math.min(1, minCost / c));
  };

  // ─── Crédito y entrega: max → 1, min → 0 (escala lineal por dimensión) ───
  const credits = candidates.map((c) => Math.max(0, Number(c.creditDays) || 0));
  const maxCredit = Math.max(...credits, 0);
  const computeCredit = (days: number) => (maxCredit > 0 ? days / maxCredit : 1);

  const deliveries = candidates.map((c) =>
    c.deliveryDays != null && Number.isFinite(c.deliveryDays) ? Number(c.deliveryDays) : Infinity,
  );
  const minDelivery = Math.min(...deliveries.filter((d) => Number.isFinite(d)));
  const computeDelivery = (days: number | null) => {
    if (days == null || !Number.isFinite(days)) return 0.5; // penaliza desconocido pero no a 0
    if (!Number.isFinite(minDelivery)) return 1;
    if (days <= 0) return 1;
    return Math.max(0, Math.min(1, minDelivery / days));
  };

  // ─── Scoring por candidato ──────────────────────────────────────────
  const scored = candidates.map((c) => {
    const netCost = Math.max(0, Number(c.netCostUsd) || 0);
    const cost = computeCost(netCost);

    // Disponibilidad: 1 si cubre toda la cantidad, escala por % cubierto, 0.5 si desconocido.
    let availability = 0.5;
    if (c.availableQty != null && Number.isFinite(c.availableQty)) {
      if (quantity <= 0) availability = 1;
      else availability = Math.max(0, Math.min(1, Number(c.availableQty) / quantity));
    }

    // Vencimiento: 1 si ≥ HEALTHY (180d), 0 si < BLOCK (90d), escala lineal entre medio.
    let expiry = 0.5;
    if (c.lotExpiryDate) {
      const d = c.lotExpiryDate instanceof Date ? c.lotExpiryDate : new Date(c.lotExpiryDate);
      const daysToExpiry = Math.floor((d.getTime() - asOf.getTime()) / 86400000);
      if (daysToExpiry <= ENGINE_PARAMS.EXPIRY_BLOCK_DAYS) expiry = 0;
      else if (daysToExpiry >= ENGINE_PARAMS.EXPIRY_HEALTHY_DAYS) expiry = 1;
      else
        expiry =
          (daysToExpiry - ENGINE_PARAMS.EXPIRY_BLOCK_DAYS) /
          (ENGINE_PARAMS.EXPIRY_HEALTHY_DAYS - ENGINE_PARAMS.EXPIRY_BLOCK_DAYS);
    }

    const credit = computeCredit(Number(c.creditDays) || 0);
    const delivery = computeDelivery(c.deliveryDays);

    const w = ENGINE_PARAMS.COMPARATOR_WEIGHTS;
    const score =
      w.cost * cost + w.availability * availability + w.expiry * expiry + w.credit * credit + w.delivery * delivery;

    return {
      ...c,
      score: round2(score * 100),
      components: {
        cost: round3(cost),
        availability: round3(availability),
        expiry: round3(expiry),
        credit: round3(credit),
        delivery: round3(delivery),
      },
    };
  });

  // Orden descendente y asignar rank.
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s, idx) => ({ ...s, rank: idx + 1 }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
