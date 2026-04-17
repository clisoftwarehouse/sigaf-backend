import * as XLSX from 'xlsx';

type TemplateSpec = {
  headers: string[];
  examples: (string | number | boolean)[][];
};

/**
 * Definición canónica de columnas y filas de ejemplo para cada tipo de importación.
 * Los headers DEBEN coincidir exactamente (salvo normalización) con los que cada
 * importer espera al leer filas del sheet-parser.
 */
const TEMPLATES: Record<string, TemplateSpec> = {
  products: {
    headers: [
      'ean',
      'internal_code',
      'description',
      'short_name',
      'category_code_or_name',
      'brand_name',
      'product_type',
      'is_controlled',
      'requires_recipe',
      'is_antibiotic',
      'is_weighable',
      'unit_of_measure',
      'tax_type',
      'pmvp',
      'stock_min',
      'is_active',
    ],
    examples: [
      [
        '7591234567890',
        '',
        'Acetaminofén 500mg x 20 tabletas',
        'Acetaminofén 500mg',
        'MEDICAMENTOS',
        'Genven',
        'pharmaceutical',
        false,
        false,
        false,
        false,
        'UND',
        'exempt',
        5.5,
        10,
        true,
      ],
      [
        '',
        'PROD-000123',
        'Arroz Blanco 1kg',
        'Arroz 1kg',
        'ALIMENTOS',
        '',
        'grocery',
        false,
        false,
        false,
        false,
        'UND',
        'general',
        '',
        20,
        true,
      ],
    ],
  },
  'stock-initial': {
    headers: [
      'product_ean',
      'branch_name',
      'lot_number',
      'expiration_date',
      'manufacture_date',
      'acquisition_type',
      'cost_usd',
      'sale_price',
      'quantity_received',
    ],
    examples: [
      ['7591234567890', 'Sucursal Principal', 'LOT-2026-001', '2027-12-31', '2026-01-15', 'purchase', 2.5, 5.0, 100],
      ['7591234567891', 'Sucursal Principal', 'LOT-2026-002', '2027-06-30', '', 'purchase', 1.2, 3.5, 50],
    ],
  },
  prices: {
    headers: ['product_ean', 'branch_name', 'price_usd', 'effective_from', 'effective_to', 'notes'],
    examples: [
      ['7591234567890', '', 5.5, '2026-01-01', '', 'Precio base global'],
      ['7591234567890', 'Sucursal Principal', 5.25, '2026-01-01', '', 'Override sucursal'],
    ],
  },
};

export class TemplateBuilder {
  /**
   * Genera un buffer XLSX con headers y filas de ejemplo para el tipo dado.
   * @returns Buffer binario del XLSX listo para descargar.
   */
  static build(type: string): Buffer {
    const spec = TEMPLATES[type];
    if (!spec) throw new Error(`Template no definido para tipo: ${type}`);

    const rows = [spec.headers, ...spec.examples];
    const sheet = XLSX.utils.aoa_to_sheet(rows);

    // Anchura de columna sugerida = max(header.length, 14)
    sheet['!cols'] = spec.headers.map((h) => ({ wch: Math.max(h.length + 2, 14) }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Template');

    const buf = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    return buf;
  }

  static availableTypes(): string[] {
    return Object.keys(TEMPLATES);
  }
}
