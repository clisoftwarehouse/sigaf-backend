import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { EmissionPluginMetadata } from '../plugin.interface';
import { VentaListaEvent } from '../events/venta-lista.event';
import { DocumentEmissionService } from '../../document-emission/document-emission.service';

/**
 * Recibo provisional — comprobante interno previo a la facturación posterior.
 * Server-side: el backend lo registra al recibir el evento.
 */
export const metadata: EmissionPluginMetadata = {
  key: 'provisional_receipt',
  displayName: 'Recibo provisional',
  requiresLocalDriver: false,
  configSchema: {
    type: 'object',
    properties: {
      series: { type: 'string', description: 'Serie del correlativo (opcional)' },
    },
  },
};

@EventsHandler(VentaListaEvent)
export class ProvisionalReceiptEmissionHandler implements IEventHandler<VentaListaEvent> {
  constructor(private readonly emission: DocumentEmissionService) {}

  async handle(event: VentaListaEvent): Promise<void> {
    const cfg = await this.emission.findActive(event.terminalId, 'provisional_receipt');
    if (!cfg) return;

    const series = (cfg.configJson?.series as string) ?? 'RP';
    await this.emission.recordDocument({
      saleTicketId: event.ticketId,
      documentType: 'provisional_receipt',
      documentNumber: `${series}-${event.createdAt.getTime()}`,
      emissionMethodId: cfg.id,
      status: 'emitted',
    });
  }
}
