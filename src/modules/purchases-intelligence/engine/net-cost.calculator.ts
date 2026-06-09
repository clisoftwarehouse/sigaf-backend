/**
 * Calculadora de costo neto en 3 escenarios.
 *
 * 5 capas de descuento, MULTIPLICATIVAS (no aditivas — PRD §16.1):
 *   cabecera (droguería)
 *   lineal (laboratorio)
 *   volumen (droguería, condicionado a umbral)
 *   escala (laboratorio, condicionado a umbral)
 *   pronto pago (droguería, opcional financiero)
 *
 * Escenarios:
 *   - conservador: solo cabecera + lineal (descuentos seguros, aplican siempre)
 *   - comercial:   + volumen + escala (cuando se cumplen umbrales)
 *   - financiero:  + pronto pago (informativo, NO se usa como base de margen)
 *
 * El margen del producto SIEMPRE se proyecta contra el escenario
 * conservador para no sobre-prometer. El pronto pago es bonus si se paga
 * en plazo, no se asume (PRD §7.2 / §16.2).
 *
 * Pure function — no importa Repositories ni hace I/O.
 */

export type NetCostInput = {
  /** Precio base USD del proveedor antes de aplicar descuentos. */
  basePriceUsd: number;

  /**
   * Descuento específico pactado para este SKU con este proveedor
   * (`supplier_products.discount_pct`). Aplica como primera capa, antes
   * de los descuentos framework. 0 o null si no hay.
   */
  supplierProductDiscountPct?: number | null;

  /** Condición de droguería activa (cabecera, volumen, pronto pago). */
  drugstoreCondition?: {
    cabeceraPct: number;
    volumenPct: number;
    prontoPagoPct: number;
    volumenMinUsd: number | null;
    volumenMinUnits: number | null;
  } | null;

  /** Condición de laboratorio activa (lineal, escala). */
  labCondition?: {
    linealPct: number;
    escalaPct: number;
    escalaMinUnits: number | null;
  } | null;

  /**
   * Total USD de la compra global a esta droguería (para evaluar si se
   * supera el umbral de volumen). Si no hay otros items, pasar 0.
   */
  totalPurchaseUsd: number;

  /**
   * Total de unidades de la línea (para evaluar el umbral de escala del
   * laboratorio). Si la condición no requiere escala, pasar 0.
   */
  totalUnits: number;
};

export type NetCostBreakdown = {
  /** Costo bruto antes de descuentos. */
  basePriceUsd: number;
  /** % de descuento aplicado por cada capa (0 si no aplicó). */
  appliedDiscounts: {
    supplierProductPct: number;
    cabeceraPct: number;
    linealPct: number;
    volumenPct: number;
    escalaPct: number;
    prontoPagoPct: number;
  };
  /** Cabecera + lineal — el "piso" seguro del precio neto. */
  conservative: number;
  /** + volumen + escala — el precio que probablemente vamos a pagar. */
  commercial: number;
  /** + pronto pago — el precio ideal si pagamos en plazo. */
  financial: number;
};

/**
 * Aplica una capa de descuento al costo actual.
 * `pct` es 0-100. Devuelve el costo neto y el porcentaje efectivo aplicado.
 */
function applyLayer(currentCost: number, pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return currentCost;
  const clamped = Math.min(pct, 100);
  return currentCost * (1 - clamped / 100);
}

export function calculateNetCost(input: NetCostInput): NetCostBreakdown {
  const base = Number(input.basePriceUsd) || 0;
  const dc = input.drugstoreCondition;
  const lc = input.labCondition;

  // Capa 0: descuento específico por SKU pactado en supplier_products.
  const supplierProductPct = Number(input.supplierProductDiscountPct) || 0;

  // Capa 1: cabecera (siempre aplica si existe)
  const cabeceraPct = Number(dc?.cabeceraPct) || 0;

  // Capa 2: lineal (siempre aplica si existe)
  const linealPct = Number(lc?.linealPct) || 0;

  // Capa 3: volumen — condicionado a umbral USD o unidades
  let volumenPct = 0;
  if (dc && Number(dc.volumenPct) > 0) {
    const meetsUsd = dc.volumenMinUsd != null && input.totalPurchaseUsd >= Number(dc.volumenMinUsd);
    const meetsUnits = dc.volumenMinUnits != null && input.totalUnits >= Number(dc.volumenMinUnits);
    const hasUmbral = dc.volumenMinUsd != null || dc.volumenMinUnits != null;
    // Si no hay umbral definido, asumimos que aplica siempre.
    // Si hay umbral, basta con cumplir UNO de los dos.
    if (!hasUmbral || meetsUsd || meetsUnits) {
      volumenPct = Number(dc.volumenPct);
    }
  }

  // Capa 4: escala — condicionado a unidades
  let escalaPct = 0;
  if (lc && Number(lc.escalaPct) > 0) {
    const meetsScale = lc.escalaMinUnits != null && input.totalUnits >= Number(lc.escalaMinUnits);
    const hasUmbral = lc.escalaMinUnits != null;
    if (!hasUmbral || meetsScale) {
      escalaPct = Number(lc.escalaPct);
    }
  }

  // Capa 5: pronto pago (siempre informativo)
  const prontoPagoPct = Number(dc?.prontoPagoPct) || 0;

  // Aplicación multiplicativa en cascada.
  const afterSupplierProduct = applyLayer(base, supplierProductPct);
  const afterCabecera = applyLayer(afterSupplierProduct, cabeceraPct);
  const afterLineal = applyLayer(afterCabecera, linealPct);
  const conservative = round4(afterLineal);

  const afterVolumen = applyLayer(afterLineal, volumenPct);
  const afterEscala = applyLayer(afterVolumen, escalaPct);
  const commercial = round4(afterEscala);

  const afterProntoPago = applyLayer(afterEscala, prontoPagoPct);
  const financial = round4(afterProntoPago);

  return {
    basePriceUsd: round4(base),
    appliedDiscounts: {
      supplierProductPct,
      cabeceraPct,
      linealPct,
      volumenPct,
      escalaPct,
      prontoPagoPct,
    },
    conservative,
    commercial,
    financial,
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
