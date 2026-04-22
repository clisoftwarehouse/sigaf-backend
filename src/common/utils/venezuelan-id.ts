/**
 * Helpers de validación y normalización para identificadores venezolanos:
 * cédula (V/E), RIF (V/E/J/G/P) y teléfono local.
 *
 * Estos transformers se usan vía `@Transform(({ value }) => normalizeX(value))`
 * en los DTOs y los regex se aplican con `@Matches(...)`.
 */

// ─── Cédula ──────────────────────────────────────────────────────────────
// Formato canónico: V-12345678 ó E-12345678 (6 a 9 dígitos).
export const CEDULA_REGEX = /^[VE]-\d{6,9}$/;
export const CEDULA_HINT = 'Cédula debe tener formato V-12345678 ó E-12345678';

export function normalizeCedula(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  // Acepta entrada "v12345678" → "V-12345678"
  const compact = cleaned.replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([VE])(\d{6,9})$/);
  return match ? `${match[1]}-${match[2]}` : cleaned;
}

// ─── RIF ─────────────────────────────────────────────────────────────────
// Formato canónico: J-12345678-9 (V/E/J/G/P, 7-9 dígitos, dígito verificador)
export const RIF_REGEX = /^[VEJGP]-\d{7,9}-\d$/;
export const RIF_HINT = 'RIF debe tener formato J-12345678-9 (V/E/J/G/P)';

export function normalizeRif(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  const compact = cleaned.replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^([VEJGP])(\d{7,9})(\d)$/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : cleaned;
}

// ─── Teléfono ────────────────────────────────────────────────────────────
// Formato canónico: +58XXXXXXXXXX (12 dígitos totales, código operador 2XX o 4XX)
export const PHONE_REGEX = /^\+58[24]\d{9}$/;
export const PHONE_HINT = 'Teléfono debe ser un número venezolano válido (ej. +584121234567 ó 04121234567)';

export function normalizePhone(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const stripped = value.trim().replace(/[\s\-()]/g, '');
  if (stripped.length === 0) return stripped;
  if (stripped.startsWith('+58')) return stripped;
  if (stripped.startsWith('58') && stripped.length === 12) return `+${stripped}`;
  if (stripped.startsWith('0') && stripped.length === 11) return `+58${stripped.slice(1)}`;
  if (/^\d{10}$/.test(stripped)) return `+58${stripped}`;
  return stripped;
}
