/**
 * Parámetros centralizados del motor de compras.
 *
 * Cumple PRD §8.5: el motor expone sus parámetros en un solo archivo para
 * que el cliente pueda ajustarlos sin redeploy (en una iteración futura
 * estos valores se moverán a `config_global` y se cargarán dinámicamente).
 *
 * Cualquier número mágico que afecte una decisión del motor (ej. umbrales
 * de score, pesos, días de cobertura) DEBE vivir acá. No hardcodear en
 * los calculators ni en el service.
 */
export const ENGINE_PARAMS = {
  /**
   * Pesos del score ABCD (5 dimensiones, suman 1.00).
   * Recorte 2026-05-28: bajamos de 7 a 5 dimensiones. Estacionalidad sigue
   * existiendo como índice de ajuste OPCIONAL del sugerido, no como
   * componente del score.
   */
  SCORE_WEIGHTS: {
    rotation: 0.35,
    pareto: 0.25,
    margin: 0.2,
    inventoryDays: 0.15,
    expiry: 0.05,
  } as const,

  /**
   * Umbrales del score para clasificar ABCD. Score 0-100.
   *   ≥ 75 → A
   *   ≥ 50 → B
   *   ≥ 25 → C
   *   < 25 → D
   */
  ABCD_THRESHOLDS: {
    A: 75,
    B: 50,
    C: 25,
  } as const,

  /**
   * Pareto: acumular productos ordenados por score (50% unidades + 50%
   * margen monetario) hasta cubrir este porcentaje del total. Los que
   * caen dentro son Pareto.
   */
  PARETO_THRESHOLD: 0.8,

  /**
   * Días de cobertura sugeridos por categoría — cuántos días de stock
   * mantener al recomprar.
   */
  COVERAGE_DAYS: {
    A: 30,
    B: 45,
    C: 60,
    D: 90,
  } as const,

  /** Ventana en días para calcular daily_velocity (PRD §9.1.1). */
  ROTATION_WINDOW_DAYS: 90,

  /**
   * Umbrales para considerar margen "sano" (PRD §9.1.3).
   * El componente devuelve 1 si margen ≥ HEALTHY_PCT, 0 si margen ≤ MIN_PCT,
   * y escala linealmente en el medio.
   */
  MARGIN_HEALTHY_PCT: 25,
  MARGIN_MIN_PCT: 5,

  /**
   * Umbrales para días de inventario.
   *   ≤ COMFORTABLE → 1 (sobrestock controlado, no penaliza)
   *   ≤ ACCEPTABLE  → escala lineal hacia 0
   *   > ACCEPTABLE  → 0 (riesgo de quiebre o sobrestock alto)
   */
  INVENTORY_DAYS_COMFORTABLE: 30,
  INVENTORY_DAYS_ACCEPTABLE: 120,

  /**
   * Vencimiento.
   *   ≥ 180 días al vencimiento → componente 1 (verde)
   *   90-180 → 0.5 (amarillo)
   *   < 90 → 0 (bloqueado para compra)
   */
  EXPIRY_BLOCK_DAYS: 90,
  EXPIRY_HEALTHY_DAYS: 180,

  /**
   * Comparador de droguerías: 5 dimensiones ponderadas (PRD §9.2).
   * Suma 1.00.
   */
  COMPARATOR_WEIGHTS: {
    cost: 0.5,
    availability: 0.15,
    expiry: 0.15,
    credit: 0.1,
    delivery: 0.1,
  } as const,
};

export type EngineParams = typeof ENGINE_PARAMS;
