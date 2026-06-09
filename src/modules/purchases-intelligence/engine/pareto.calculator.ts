import { ENGINE_PARAMS } from './engine-params';

/**
 * Marca productos Pareto según la regla 50% unidades + 50% margen monetario.
 *
 * Cada producto recibe un "score Pareto" igual a la combinación normalizada:
 *   paretoScore = 0.5 * (units / maxUnits) + 0.5 * (margin / maxMargin)
 *
 * Después se ordenan descendente por paretoScore y se acumula. Los
 * productos que entran al primer 80% acumulado del score total son Pareto.
 * (PRD §9.1.2, regla clásica 80/20 ajustada para usar 2 dimensiones).
 *
 * Pure function: data in → data out. Sin I/O.
 */

export type ParetoInputItem = {
  productId: string;
  /** Unidades vendidas en la ventana (típicamente 90 días). */
  unitsSold: number;
  /** Contribución absoluta al margen en la misma ventana, en USD. */
  marginUsd: number;
};

export type ParetoOutputItem = {
  productId: string;
  isPareto: boolean;
  /** Score combinado 0-1 (componente del score ABCD). */
  paretoScore: number;
};

export function calculatePareto(items: ParetoInputItem[]): ParetoOutputItem[] {
  if (!items || items.length === 0) return [];

  const maxUnits = Math.max(...items.map((i) => Math.max(0, Number(i.unitsSold) || 0)), 0);
  const maxMargin = Math.max(...items.map((i) => Math.max(0, Number(i.marginUsd) || 0)), 0);

  // Si todo es 0, ningún producto es Pareto.
  if (maxUnits === 0 && maxMargin === 0) {
    return items.map((i) => ({ productId: i.productId, isPareto: false, paretoScore: 0 }));
  }

  const scored = items.map((i) => {
    const u = maxUnits > 0 ? (Number(i.unitsSold) || 0) / maxUnits : 0;
    const m = maxMargin > 0 ? (Number(i.marginUsd) || 0) / maxMargin : 0;
    const paretoScore = 0.5 * u + 0.5 * m;
    return { productId: i.productId, paretoScore };
  });

  // Orden descendente por score.
  scored.sort((a, b) => b.paretoScore - a.paretoScore);

  // Acumular hasta cubrir PARETO_THRESHOLD del score total.
  const totalScore = scored.reduce((s, x) => s + x.paretoScore, 0);
  const target = totalScore * ENGINE_PARAMS.PARETO_THRESHOLD;

  let acc = 0;
  const paretoIds = new Set<string>();
  for (const item of scored) {
    if (acc >= target) break;
    paretoIds.add(item.productId);
    acc += item.paretoScore;
  }

  // Devolver en el ORDEN ORIGINAL del input para no sorprender al caller.
  const scoreById = new Map(scored.map((s) => [s.productId, s.paretoScore]));
  return items.map((i) => ({
    productId: i.productId,
    isPareto: paretoIds.has(i.productId),
    paretoScore: round4(scoreById.get(i.productId) ?? 0),
  }));
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
