import { Agent } from 'undici';
import { Logger, Injectable, ServiceUnavailableException } from '@nestjs/common';

/**
 * Scraper de la tasa oficial USD/VES publicada por el BCV (https://www.bcv.org.ve/).
 * La página incluye un bloque HTML con `id="dolar"` y una etiqueta `<strong>`
 * que contiene el valor numérico (formato venezolano: "480,25720000").
 *
 * Usa `fetch` nativo de Node 18+ con un `undici.Agent` custom que tolera el
 * certificado TLS con cadena incompleta que publica bcv.org.ve.
 */
@Injectable()
export class BcvScraperService {
  private readonly logger = new Logger(BcvScraperService.name);
  private readonly BCV_URL = 'https://www.bcv.org.ve/';
  private readonly REQUEST_TIMEOUT_MS = 20_000;

  // Agent tolerante con TLS roto del BCV. Scope limitado a este servicio.
  private readonly bcvAgent = new Agent({
    connect: { rejectUnauthorized: false },
    headersTimeout: 20_000,
    bodyTimeout: 20_000,
  });

  /**
   * Obtiene la tasa USD→VES y la fecha efectiva publicada por el BCV.
   * Lanza `ServiceUnavailableException` si el sitio no responde o el HTML
   * cambia de forma que la tasa no pueda parsearse.
   */
  async fetchUsdVes(): Promise<{ rate: number; effectiveDate: Date }> {
    const html = await this.fetchHtml();
    const rate = this.parseUsdRate(html);
    const effectiveDate = this.parseEffectiveDate(html) ?? this.today();
    return { rate, effectiveDate };
  }

  private async fetchHtml(): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(this.BCV_URL, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-VE,es;q=0.9,en;q=0.8',
        },
        // `dispatcher` es específico de undici (fetch nativo en Node). Lo pasamos
        // para habilitar el Agent tolerante con el TLS del BCV.
        dispatcher: this.bcvAgent,
      } as RequestInit & { dispatcher: Agent });
      if (!response.ok) {
        throw new ServiceUnavailableException(`BCV respondió HTTP ${response.status}`);
      }
      return await response.text();
    } catch (err) {
      const e = err as Error & { cause?: { code?: string; message?: string } };
      const cause = e.cause?.code || e.cause?.message || '';
      const detail = cause ? `${e.message} (${cause})` : e.message;
      this.logger.error(`No se pudo obtener HTML del BCV: ${detail}`);
      throw new ServiceUnavailableException(`No se pudo consultar la tasa BCV: ${detail}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extrae la tasa USD del HTML. Estructura esperada del BCV:
   *   <div id="dolar" class="...">
   *     <div class="field-content">
   *       <div class="row recuadrotsmc">
   *         <div class="col-sm-6 col-xs-6"><img...><span> USD</span></div>
   *         <div class="col-sm-6 col-xs-6 centrado"><strong> 480,25720000 </strong></div>
   *       </div>
   *     </div>
   *   </div>
   *
   * Estrategia: localizar `id="dolar"` y buscar el primer `<strong>` con un
   * número dentro de una ventana de 2KB posterior. Esto resiste a que el BCV
   * agregue/modifique divs intermedios.
   */
  private parseUsdRate(html: string): number {
    const dolarIdx = html.search(/id\s*=\s*["']dolar["']/i);
    if (dolarIdx === -1) {
      throw new ServiceUnavailableException('No se encontró el bloque id="dolar" en la página del BCV');
    }
    const window = html.slice(dolarIdx, dolarIdx + 2000);
    const strongMatch = window.match(/<strong>\s*([\d.,]+)\s*<\/strong>/i);
    if (!strongMatch) {
      throw new ServiceUnavailableException('No se encontró la tasa USD en el bloque #dolar');
    }
    const raw = strongMatch[1].trim();
    // Formato venezolano: "480,25720000" o "36.300,00". Convertimos a float.
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const value = parseFloat(normalized);
    if (!Number.isFinite(value) || value <= 0) {
      throw new ServiceUnavailableException(`Tasa BCV inválida: "${raw}"`);
    }
    return value;
  }

  /**
   * Intenta extraer la fecha efectiva (`<span>Fecha Valor...</span>`). Si el
   * parseo falla, retorna `null` y el caller usa la fecha de hoy.
   */
  private parseEffectiveDate(html: string): Date | null {
    const dateMatch = html.match(/Fecha Valor[:\s]*<\/span>\s*<span[^>]*>\s*([^<]+?)\s*</i);
    if (!dateMatch) return null;
    const text = dateMatch[1].trim();
    // Formato esperado: "Miércoles, 16 Abril 2026"
    const months: Record<string, number> = {
      enero: 0,
      febrero: 1,
      marzo: 2,
      abril: 3,
      mayo: 4,
      junio: 5,
      julio: 6,
      agosto: 7,
      septiembre: 8,
      octubre: 9,
      noviembre: 10,
      diciembre: 11,
    };
    const m = text.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (!m) return null;
    const day = parseInt(m[1], 10);
    const month = months[m[2].toLowerCase()];
    const year = parseInt(m[3], 10);
    if (month === undefined) return null;
    return new Date(Date.UTC(year, month, day));
  }

  private today(): Date {
    const d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
}
