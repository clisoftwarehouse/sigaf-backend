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
// Formato canónico (estricto, con DV): 1 letra prefijo + 8 dígitos + 1 dígito
// verificador. Ej. J-12345678-9. Total 10 dígitos sin guiones.
export const RIF_REGEX = /^[VEJGP]-\d{8}-\d$/;
export const RIF_HINT = 'RIF debe tener formato J-12345678-9 (8 dígitos + verificador)';

// Regex específico para sucursales: solo personas jurídicas (J).
export const BRANCH_RIF_REGEX = /^J-\d{8}-\d$/;
export const BRANCH_RIF_HINT = 'RIF de sucursal debe ser jurídico: J-12345678-9';

// Regex permisivo para proveedores: jurídicos (J/G) con DV, naturales (V/E/P)
// SIN DV. SENIAT solo emite DV para personas jurídicas; las naturales que se
// registran como proveedor usan su cédula como base sin verificador.
export const SUPPLIER_RIF_REGEX = /^(?:[JG]-\d{8}-\d|[VEP]-\d{8})$/;
export const SUPPLIER_RIF_HINT = 'RIF: J-12345678-9 (jurídico, con DV) o V-12345678 (natural, sin DV)';

export function normalizeRif(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const cleaned = value.trim().toUpperCase().replace(/\s+/g, '');
  const compact = cleaned.replace(/[^A-Z0-9]/g, '');
  // Aceptamos:
  //   - Jurídico/Gobierno (J/G): 8 dígitos + verificador = "J-12345678-9"
  //   - Natural/Pasaporte (V/E/P): 8 dígitos sin verificador = "V-12345678"
  const jg = compact.match(/^([JG])(\d{8})(\d)$/);
  if (jg) return `${jg[1]}-${jg[2]}-${jg[3]}`;
  const natural = compact.match(/^([VEP])(\d{8})$/);
  if (natural) return `${natural[1]}-${natural[2]}`;
  // Fallback: si vino con DV (formato viejo) lo respetamos
  const withDv = compact.match(/^([VEP])(\d{8})(\d)$/);
  if (withDv) return `${withDv[1]}-${withDv[2]}-${withDv[3]}`;
  return cleaned;
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
