import { Agent } from 'undici';
import { Logger, Injectable } from '@nestjs/common';

export interface VademecumCandidate {
  name: string;
  atcCode: string | null;
  slug: string;
  url: string;
}

export interface VademecumAtcLevel {
  atcCode: string;
  name: string;
  level: 1 | 2 | 3 | 4;
  url: string;
}

/**
 * Scraper best-effort de https://www.vademecum.es para obtener codificación
 * internacional (ATC / INN) de principios activos.
 *
 * Estrategia:
 *  - Vademecum publica URLs de principios activos con el patrón
 *    `/principios-activos-<slug>-<atc>` (ej. `/principios-activos-losartan-c09ca01`).
 *  - La página de búsqueda `/buscar?q=...&cc=ve` devuelve anchors con el
 *    patrón anterior en el atributo `onclick`. Extraemos nombre + ATC.
 *  - La página de detalle de cada principio contiene la jerarquía ATC completa
 *    (niveles 1-4) en anchors `class="negro" href="/atc-ve?atc=..."`.
 *
 * Si vademecum cambia estructura o bloquea el scraper, devolvemos lista vacía
 * en lugar de reventar: el usuario puede ingresar el ATC manualmente.
 */
@Injectable()
export class VademecumScraperService {
  private readonly logger = new Logger(VademecumScraperService.name);
  private readonly BASE_URL = 'https://www.vademecum.es';
  private readonly REQUEST_TIMEOUT_MS = 15_000;

  private readonly agent = new Agent({
    connect: { rejectUnauthorized: false },
    headersTimeout: 15_000,
    bodyTimeout: 15_000,
  });

  async search(query: string, limit = 10): Promise<VademecumCandidate[]> {
    const clean = query.trim();
    if (!clean) return [];

    // URL de búsqueda de vademecum.es (variante Venezuela: cc=ve).
    // Se prueban varios fallbacks por si cambian el endpoint o bloquean por país.
    const q = encodeURIComponent(clean);
    const urls = [
      `${this.BASE_URL}/buscar?q=${q}&cc=ve`,
      `${this.BASE_URL}/buscar?q=${q}`,
      `${this.BASE_URL}/principios-activos-${encodeURIComponent(clean.toLowerCase())}`,
    ];

    for (const url of urls) {
      this.logger.log(`Vademecum GET ${url}`);
      const html = await this.fetchHtml(url);
      if (!html) continue;

      const candidates = this.parseCandidates(html);
      this.logger.log(`Vademecum ${url} → ${html.length} bytes, ${candidates.length} candidatos`);
      if (candidates.length > 0) return candidates.slice(0, limit);

      // Diagnóstico: log muestra del HTML para ajustar regex al patrón real
      this.logger.warn(`Vademecum sin candidatos. Sample HTML (1500c): ${html.replace(/\s+/g, ' ').slice(0, 1500)}`);
    }

    return [];
  }

  /**
   * Devuelve los primeros N bytes del HTML crudo (para debugging del parser).
   * NO usar en producción — está pensado solo para ajustar el regex.
   */
  async debugFetch(query: string): Promise<{ url: string; status: 'ok' | 'failed'; sample: string }> {
    const clean = query.trim();
    const url = `${this.BASE_URL}/buscar?q=${encodeURIComponent(clean)}&cc=ve`;
    const html = await this.fetchHtml(url);
    if (!html) return { url, status: 'failed', sample: '' };
    return { url, status: 'ok', sample: html.slice(0, 5000) };
  }

  /**
   * Extrae la jerarquía ATC (niveles 1-4) de un principio activo. Busca el
   * primer candidato por `query`, visita su ficha y parsea los enlaces
   * `<a class="negro" href="/atc-ve?atc=...">CODE: Nombre</a>`.
   *
   * Ejemplo para losartán (C09CA01):
   *   [
   *     { atcCode: 'C',     name: 'Sistema cardiovascular',                               level: 1, url: ... },
   *     { atcCode: 'C09',   name: 'Agentes activos sobre el sistema renina-angiotensina', level: 2, url: ... },
   *     { atcCode: 'C09C',  name: 'Bloqueantes de receptores de angiotensina II ...',     level: 3, url: ... },
   *     { atcCode: 'C09CA', name: 'Bloqueantes de receptores de angiotensina II ...',     level: 4, url: ... },
   *   ]
   */
  async fetchAtcHierarchy(query: string): Promise<VademecumAtcLevel[]> {
    const clean = query.trim();
    if (!clean) return [];

    const [first] = await this.search(clean, 1);
    if (!first) {
      this.logger.warn(`No se encontró ningún candidato vademecum para "${clean}"`);
      return [];
    }

    const html = await this.fetchHtml(first.url);
    if (!html) return [];

    return this.parseAtcHierarchy(html);
  }

  /** Parsea los 4 niveles ATC de una página de detalle de principio activo. */
  private parseAtcHierarchy(html: string): VademecumAtcLevel[] {
    const regex =
      /<a\s+class=["']negro["']\s+href=["']\/atc-ve\?atc=([A-Z0-9]+)["'][^>]*>\s*([A-Z0-9]+)\s*:\s*([^<]+?)\s*<\/a>/gi;

    const seen = new Set<string>();
    const levels: VademecumAtcLevel[] = [];

    for (const m of html.matchAll(regex)) {
      const [, hrefCode, , rawName] = m;
      const code = hrefCode.toUpperCase();
      if (seen.has(code)) continue;
      seen.add(code);

      const level = this.atcLevel(code);
      if (!level) continue; // ignora códigos completos de principio (nivel 5)

      levels.push({
        atcCode: code,
        name: this.decodeHtmlEntities(rawName.trim()),
        level,
        url: `${this.BASE_URL}/atc-ve?atc=${code}`,
      });
    }

    return levels.sort((a, b) => a.level - b.level);
  }

  /** Determina el nivel ATC por longitud: 1=Letra, 2=Letra+2dig, 3=..+Letra, 4=..+Letra. */
  private atcLevel(code: string): 1 | 2 | 3 | 4 | null {
    if (/^[A-Z]$/.test(code)) return 1;
    if (/^[A-Z]\d{2}$/.test(code)) return 2;
    if (/^[A-Z]\d{2}[A-Z]$/.test(code)) return 3;
    if (/^[A-Z]\d{2}[A-Z]{2}$/.test(code)) return 4;
    return null;
  }

  private async fetchHtml(url: string): Promise<string | null> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        dispatcher: this.agent,
      } as RequestInit & { dispatcher: Agent });
      if (!response.ok) {
        this.logger.warn(`vademecum.es respondió HTTP ${response.status} para "${url}"`);
        return null;
      }
      return await response.text();
    } catch (err) {
      const e = err as Error & { cause?: { code?: string; message?: string } };
      const detail = e.cause?.code || e.cause?.message || e.message;
      this.logger.warn(`No se pudo consultar vademecum.es: ${detail}`);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Extrae candidatos del HTML de la página de resultados de vademecum.es.
   *
   * Los principios activos se rendean como:
   *   <a title="ATC" alt="ATC"
   *      onclick="document.location='/principios-activos-<slug>-<ATC>-ve';return false;"
   *      href="#">Losartán</a>
   *
   * El href real es "#"; la URL está en el atributo `onclick`. El ATC puede
   * tener sufijos de combinación (`+P1`, `+P2`) para principios compuestos.
   */
  private parseCandidates(html: string): VademecumCandidate[] {
    const seen = new Set<string>();
    const results: VademecumCandidate[] = [];

    // Grupos: 1=path, 2=slug, 3=ATC, 4=nombre visible
    const regex =
      /<a\s+title=["']ATC["'][^>]*onclick=["']document\.location=['"](\/principios-activos-([a-z0-9-]+?)-([A-Z]\d{2}[A-Z]{0,2}\d{0,2}(?:\+P\d)?)-ve)['"];[^>]*>([^<]+)<\/a>/gi;

    for (const m of html.matchAll(regex)) {
      const [, path, slug, atcRaw, displayName] = m;
      if (seen.has(path)) continue;
      seen.add(path);
      results.push({
        name: this.decodeHtmlEntities(displayName.trim()),
        atcCode: atcRaw.toUpperCase(),
        slug,
        url: `${this.BASE_URL}${path}`,
      });
    }

    return results;
  }

  /**
   * Decodifica las entidades HTML comunes del español (vademecum devuelve
   * `&aacute;`, `&ntilde;`, etc. en lugar de caracteres Unicode directos).
   */
  private decodeHtmlEntities(text: string): string {
    const namedEntities: Record<string, string> = {
      aacute: 'á',
      eacute: 'é',
      iacute: 'í',
      oacute: 'ó',
      uacute: 'ú',
      Aacute: 'Á',
      Eacute: 'É',
      Iacute: 'Í',
      Oacute: 'Ó',
      Uacute: 'Ú',
      ntilde: 'ñ',
      Ntilde: 'Ñ',
      uuml: 'ü',
      Uuml: 'Ü',
      iquest: '¿',
      iexcl: '¡',
      amp: '&',
      lt: '<',
      gt: '>',
      quot: '"',
      apos: "'",
      nbsp: ' ',
    };
    return text
      .replace(/&([a-zA-Z]+);/g, (_, name) => namedEntities[name] ?? `&${name};`)
      .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(parseInt(code, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
  }
}
