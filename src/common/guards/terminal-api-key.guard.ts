import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import { TerminalPairingService } from '@/modules/terminals/terminal-pairing.service';

/**
 * Guard que requiere `X-Terminal-Api-Key` válido en el header.
 *
 * Se aplica a endpoints que SOLO debe poder llamar un POS pairing-ed (no
 * cualquier cliente con JWT del cajero):
 * - POST /v1/sales/tickets
 * - POST /v1/sales/returns
 * - POST /v1/sales/tickets/:id/void
 * - POST /v1/cash-sessions/open
 * - POST /v1/cash-sessions/:id/close
 *
 * Al validar, popula `req.terminal = { terminalId, branchId, apiKeyId }`
 * para que el controller pueda usarlo si quiere (ej. consistencia
 * `req.terminal.terminalId === dto.terminalId`).
 *
 * Mensaje del error es específico ("apiKey...") para que el POS lo
 * detecte y limpie el pairing local + vuelva a PairingScreen.
 */
@Injectable()
export class TerminalApiKeyGuard implements CanActivate {
  constructor(private readonly pairingService: TerminalPairingService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      terminal?: { terminalId: string; branchId: string; apiKeyId: string };
    }>();
    const headerRaw = req.headers['x-terminal-api-key'] ?? req.headers['X-Terminal-Api-Key'];
    const header = Array.isArray(headerRaw) ? headerRaw[0] : headerRaw;
    if (!header) {
      throw new UnauthorizedException(
        'apiKey de terminal requerida (header X-Terminal-Api-Key). Este endpoint solo puede invocarlo un POS emparejado.',
      );
    }
    try {
      const validated = await this.pairingService.validateApiKey(header);
      req.terminal = validated;
      return true;
    } catch {
      // Re-lanzamos con mensaje específico para que el POS pueda detectarlo
      // y limpiar el pairing local (axios interceptor mira "apikey" en msg).
      throw new UnauthorizedException('apiKey de terminal inválida o revocada. El equipo debe volver a emparejarse.');
    }
  }
}
