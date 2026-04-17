import * as XLSX from 'xlsx';
import { BadRequestException } from '@nestjs/common';

/**
 * Parser universal para archivos tabulares.
 * Soporta XLSX, XLS y CSV. Detecta el formato por la extensión (mimetype no es confiable).
 *
 * Retorna filas como objetos `Record<string, string>` donde las claves son headers
 * normalizados (lowercase, trim, sin espacios dobles). Los valores se normalizan como
 * strings recortados. El caller es responsable de parsear números / fechas / booleanos.
 */
export class SheetParser {
  /**
   * Parsea un buffer (XLSX o CSV) y devuelve filas como objetos con headers normalizados.
   * Las filas completamente vacías se omiten.
   *
   * @param buffer Buffer del archivo
   * @param filename Nombre del archivo (para detección de formato por extensión)
   */
  static parse(buffer: Buffer, filename: string): Record<string, string>[] {
    const ext = (filename.split('.').pop() || '').toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new BadRequestException(`Formato no soportado: .${ext}. Usa CSV, XLS o XLSX.`);
    }

    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`No se pudo parsear el archivo: ${msg}`);
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestException('El archivo no tiene hojas.');

    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false,
      blankrows: false,
    });

    return raw.map((row) => SheetParser.normalizeRow(row)).filter((row) => Object.values(row).some((v) => v !== ''));
  }

  /**
   * Normaliza una fila: header a snake_case lowercase, valores trimmed string.
   */
  private static normalizeRow(row: Record<string, unknown>): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = SheetParser.normalizeHeader(key);
      if (!normalizedKey) continue;
      out[normalizedKey] = SheetParser.normalizeValue(value);
    }
    return out;
  }

  private static normalizeHeader(header: string): string {
    return header
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  }

  private static normalizeValue(value: unknown): string {
    if (value === null || value === undefined) return '';
    return String(value).trim();
  }

  /**
   * Helpers de coerción para los importers. Todos aceptan el string bruto
   * y devuelven el tipo deseado o lanzan error descriptivo.
   */
  static toRequiredString(value: string | undefined, field: string): string {
    if (!value || value.trim() === '') {
      throw new Error(`Campo requerido vacío: ${field}`);
    }
    return value.trim();
  }

  static toOptionalString(value: string | undefined): string | null {
    if (!value || value.trim() === '') return null;
    return value.trim();
  }

  static toNumber(value: string | undefined, field: string, required = true): number | null {
    if (!value || value.trim() === '') {
      if (required) throw new Error(`Campo numérico requerido vacío: ${field}`);
      return null;
    }
    const normalized = value.replace(',', '.');
    const n = Number(normalized);
    if (!Number.isFinite(n)) throw new Error(`Campo '${field}' no es un número válido: '${value}'`);
    return n;
  }

  static toBoolean(value: string | undefined, defaultValue = false): boolean {
    if (!value || value.trim() === '') return defaultValue;
    const v = value.trim().toLowerCase();
    if (['true', '1', 'si', 'sí', 'yes', 'y', 'x'].includes(v)) return true;
    if (['false', '0', 'no', 'n', ''].includes(v)) return false;
    return defaultValue;
  }

  /**
   * Acepta `YYYY-MM-DD`, `DD/MM/YYYY` o `MM/DD/YYYY` (ambiguo: asume DD/MM/YYYY por convención LATAM).
   */
  static toDateString(value: string | undefined, field: string, required = true): string | null {
    if (!value || value.trim() === '') {
      if (required) throw new Error(`Fecha requerida vacía: ${field}`);
      return null;
    }
    const v = value.trim();
    // ISO YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    // DD/MM/YYYY o D/M/YYYY
    const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slash) {
      const [, d, m, y] = slash;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Intento fallback: Date.parse
    const parsed = new Date(v);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
    throw new Error(`Fecha inválida en '${field}': '${value}'. Use YYYY-MM-DD o DD/MM/YYYY.`);
  }
}
