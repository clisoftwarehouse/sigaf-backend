/**
 * Tipos de fuente de tasa de cambio soportados.
 *
 * - `BCV`: tasa oficial diaria (scrapeada del Banco Central de Venezuela).
 * - `REPOSICION`: tasa de reposición de stock. Refleja el costo real de
 *   reponer inventario cuando supera a la tasa oficial. Usada para
 *   revalorizar precios de venta. Debe ser SIEMPRE >= a la última BCV
 *   (validado en el service) para evitar pérdidas en el negocio.
 * - `manual`: override puntual (cuando BCV no publica o evento extraordinario).
 */
export const RATE_SOURCES = ['BCV', 'REPOSICION', 'manual'] as const;
export type RateSource = (typeof RATE_SOURCES)[number];
