import { AuthGuard } from '@nestjs/passport';
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { TerminalPairingService } from '@/modules/terminals/terminal-pairing.service';

/**
 * Guard híbrido: acepta JWT del cajero O `X-Terminal-Api-Key` del terminal.
 *
 * Motivación: en modo offline-first, el POS puede tener apiKey válida
 * (cacheada por el pairing) pero JWT inválido/ausente (cajero logueado
 * offline contra cache local de credenciales). Endpoints que SOLO usaban
 * `AuthGuard('jwt')` dejaban al POS offline-logueado sin poder leer su
 * propio catálogo, sesión de caja, etc. — aunque la apiKey identifica el
 * equipo correctamente.
 *
 * Estrategia:
 *   - Si viene `X-Terminal-Api-Key` válido → pasa, setea `req.terminal`.
 *   - Sino, intentamos JWT estándar; si pasa, setea `req.user`.
 *   - Si ninguno funciona → 401.
 *
 * Usar en GETs del POS: cash-sessions, products (catálogo), branches,
 * exchange-rates, inventory, tickets lookup. POSTs sensibles siguen con
 * `TerminalApiKeyGuard` solo (más estricto).
 */
@Injectable()
export class JwtOrTerminalApiKeyGuard implements CanActivate {
  constructor(private readonly pairingService: TerminalPairingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      terminal?: { terminalId: string; branchId: string; apiKeyId: string };
      user?: unknown;
    }>();

    // 1) Intentar apiKey si viene.
    const headerRaw = req.headers['x-terminal-api-key'] ?? req.headers['X-Terminal-Api-Key'];
    const apiKey = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (apiKey) {
      try {
        const validated = await this.pairingService.validateApiKey(apiKey);
        req.terminal = validated;
        return true;
      } catch {
        // apiKey inválida → caemos a JWT. Si JWT también falla, error final.
      }
    }

    // 2) Fallback a JWT estándar via Passport.
    const passport = new (AuthGuard('jwt'))();
    try {
      const ok = (await passport.canActivate(context)) as boolean;
      if (ok) return true;
    } catch {
      // ignore — error final unificado abajo.
    }

    throw new UnauthorizedException('Requiere JWT válido o apiKey de terminal en el header X-Terminal-Api-Key.');
  }
}
