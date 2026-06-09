/**
 * Configuración del proxy al servicio externo product-api-ic.
 *
 * El módulo Comparador de Precios lee mercado externo (iCompras360) vía un
 * micro-servicio HTTP que ya está deployado. Para no exponer la API key al
 * navegador del operador, el backend SIGAF actúa como proxy: el frontend
 * llama a `/v1/purchases/comparator/*` con su JWT habitual y este módulo
 * reenvía a `${PRODUCT_API_IC_URL}/api/*` agregando el header `X-API-Key`.
 *
 * Si `PRODUCT_API_IC_KEY` no está seteado, todos los endpoints devuelven
 * 503 con un mensaje claro al operador (no rompe el resto del backend).
 */
export interface ComparatorConfig {
  url: string;
  key: string | undefined;
}

export function loadComparatorConfig(): ComparatorConfig {
  return {
    url: process.env.PRODUCT_API_IC_URL ?? 'https://product-api-ic.onrender.com',
    key: process.env.PRODUCT_API_IC_KEY,
  };
}
