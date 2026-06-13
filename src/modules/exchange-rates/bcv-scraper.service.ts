import { Logger, Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * Obtiene la tasa oficial USD/VES (BCV) desde la API pública de DolarApi
 * (https://ve.dolarapi.com/v1/dolares/oficial), que expone el dólar "oficial"
 * = tasa BCV. Reemplaza al scraping directo de bcv.org.ve, que era frágil
 * (HTML cambiante + TLS con cadena incompleta).
 *
 * Respuesta esperada:
 *   {
 *     "moneda": "USD", "fuente": "oficial", "nombre": "Dólar",
 *     "compra": null, "venta": null, "promedio": 582.6862,
 *     "fechaActualizacion": "2026-06-12T00:00:00-04:00"
 *   }
 * Usamos `promedio` como tasa y la parte de fecha de `fechaActualizacion`
 * (en hora Venezuela, -04:00) como fecha efectiva.
 */
@Injectable()
export class BcvScraperService {
  private readonly logger = new Logger(BcvScraperService.name);
  private readonly API_URL = 'https://ve.dolarapi.com/v1/dolares/oficial';
  private readonly REQUEST_TIMEOUT_MS = 20_000;

  /**
   * Obtiene la tasa USD→VES y su fecha efectiva desde DolarApi. Lanza
   * `ServiceUnavailableException` si la API no responde o el payload es inválido.
   */
  async fetchUsdVes(): Promise<{ rate: number; effectiveDate: Date }> {
    const data = await this.fetchJson();
    const rate = this.parseRate(data);
    const effectiveDate = this.parseEffectiveDate(data) ?? this.today();
    return { rate, effectiveDate };
  }

  private async fetchJson(): Promise<DolarApiResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.API_URL, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) {
        throw new ServiceUnavailableException(`DolarApi respondió HTTP ${response.status}`);
      }
      return (await response.json()) as DolarApiResponse;
    } catch (err) {
      if (err instanceof ServiceUnavailableException) throw err;
      const e = err as Error & { cause?: { code?: string; message?: string } };
      const cause = e.cause?.code || e.cause?.message || '';
      const detail = cause ? `${e.message} (${cause})` : e.message;
      this.logger.error(`No se pudo obtener la tasa de DolarApi: ${detail}`);
      throw new ServiceUnavailableException(`No se pudo consultar la tasa BCV: ${detail}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /** Toma `promedio` como tasa USD→VES y valida que sea un número positivo. */
  private parseRate(data: DolarApiResponse): number {
    const value = Number(data?.promedio);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ServiceUnavailableException(`Tasa BCV inválida desde DolarApi: "${data?.promedio}"`);
    }
    return value;
  }

  /**
   * Extrae la fecha efectiva de `fechaActualizacion` (ISO con offset -04:00 de
   * Venezuela). Tomamos los primeros 10 caracteres (YYYY-MM-DD), que ya están
   * en hora local VE, y los anclamos a medianoche UTC para guardarlos como
   * fecha sin desfase de zona horaria.
   */
  private parseEffectiveDate(data: DolarApiResponse): Date | null {
    const iso = data?.fechaActualizacion;
    if (typeof iso !== 'string') return null;
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return null;
    const [, y, mo, d] = m;
    return new Date(Date.UTC(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10)));
  }

  private today(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
}

interface DolarApiResponse {
  moneda?: string;
  fuente?: string;
  nombre?: string;
  compra?: number | null;
  venta?: number | null;
  promedio?: number;
  fechaActualizacion?: string;
}
