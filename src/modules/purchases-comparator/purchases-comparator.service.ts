import { Logger, Injectable, HttpStatus, HttpException, ServiceUnavailableException } from '@nestjs/common';

import { loadComparatorConfig } from './purchases-comparator.config';

/**
 * Proxy HTTP al servicio product-api-ic con cache TTL en memoria.
 *
 * - Cache: 5 minutos por (path + query). Suficiente para que un operador
 *   navegue páginas/filtros sin pegar la API externa en cada click. El
 *   mercado se mueve en horas, no en segundos.
 * - Sin retry agresivo: el servicio externo no está en free tier, así que
 *   no hay cold-starts esperados. Errores se propagan con el mismo status.
 * - Sin librerías nuevas: usa `fetch` nativo de Node 20+.
 */
@Injectable()
export class PurchasesComparatorService {
  private readonly logger = new Logger(PurchasesComparatorService.name);
  private readonly cache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly cacheTtlMs = 5 * 60 * 1000; // 5 min

  /**
   * Llama a `${baseUrl}${path}?${query}` con la API key, cachea respuestas
   * por 5 min y propaga errores remotos como `HttpException` con el mismo
   * status. Lee `process.env` en cada call para sobrevivir a cambios de
   * env en runtime (ej. dev server con .env reloaded sin reiniciar).
   */
  async proxy<T>(path: string, query: object = {}): Promise<T> {
    const config = loadComparatorConfig();
    if (!config.key) {
      throw new ServiceUnavailableException(
        'El comparador de precios no está configurado en este ambiente (PRODUCT_API_IC_KEY).',
      );
    }

    const qs = this.buildQueryString(query);
    const cacheKey = `${path}?${qs}`;

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const url = `${config.url}${path}${qs ? `?${qs}` : ''}`;

    let res: Response;
    try {
      res = await fetch(url, {
        method: 'GET',
        headers: {
          'X-API-Key': config.key,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(20_000),
      });
    } catch (err) {
      const e = err as Error;
      this.logger.error(`product-api-ic network error en ${path}: ${e.message}`);
      throw new HttpException(`El comparador de precios no respondió: ${e.message}`, HttpStatus.BAD_GATEWAY);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      this.logger.warn(`product-api-ic ${path} → ${res.status} ${body.slice(0, 200)}`);
      throw new HttpException(body || `product-api-ic devolvió ${res.status}`, res.status as HttpStatus);
    }

    const data = (await res.json()) as T;
    this.cache.set(cacheKey, { value: data, expiresAt: Date.now() + this.cacheTtlMs });
    this.maybeEvictExpired();
    return data;
  }

  /** Limpia entradas vencidas si el cache pasa de 200 items (mantenimiento liviano). */
  private maybeEvictExpired(): void {
    if (this.cache.size < 200) return;
    const now = Date.now();
    for (const [k, v] of this.cache.entries()) {
      if (v.expiresAt <= now) this.cache.delete(k);
    }
  }

  private buildQueryString(query: object): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      params.append(k, String(v));
    }
    return params.toString();
  }
}
