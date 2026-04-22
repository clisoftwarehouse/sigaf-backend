/**
 * Helpers de validación y normalización para concentración de principios activos.
 *
 * Formato canónico: número + espacio + unidad. Ej: "500 mg", "2.5 mL", "1000 UI".
 * Acepta entrada relajada (sin espacio, con coma como separador decimal) y la normaliza.
 */

// Unidades farmacéuticas aceptadas (case-insensitive en regex; output case-corrected).
const UNIT_MAP: Record<string, string> = {
  mg: 'mg',
  g: 'g',
  mcg: 'mcg',
  µg: 'mcg',
  ug: 'mcg',
  kg: 'kg',
  ml: 'mL',
  l: 'L',
  µl: 'µL',
  ul: 'µL',
  ui: 'UI',
  iu: 'UI',
  ufc: 'UFC',
  '%': '%',
  meq: 'mEq',
};

const UNIT_NAMES = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length); // longer first
const UNIT_ALT = UNIT_NAMES.map((u) => u.replace(/[%]/g, '\\%').replace(/µ/g, '(?:µ|u)'));
export const CONCENTRATION_REGEX = new RegExp(`^\\d+(?:[.,]\\d+)?\\s?(?:${UNIT_ALT.join('|')})$`, 'i');

export const CONCENTRATION_HINT =
  'Concentración debe ser un número con unidad (mg, g, mcg, mL, L, UI, %, mEq). Ej: 500 mg, 2.5 mL';

export function normalizeConcentration(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().replace(/,/g, '.');
  if (cleaned.length === 0) return cleaned;
  const m = cleaned.match(/^(\d+(?:\.\d+)?)\s?([a-zA-Zµ%]+)$/);
  if (!m) return cleaned;
  const num = m[1];
  const rawUnit = m[2].toLowerCase();
  const canonicalUnit = UNIT_MAP[rawUnit];
  return canonicalUnit ? `${num} ${canonicalUnit}` : cleaned;
}
