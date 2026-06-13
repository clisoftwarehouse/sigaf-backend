import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { EmissionPluginMetadata } from '../plugin.interface';
import { VentaListaEvent } from '../events/venta-lista.event';
import { DocumentEmissionService } from '../../document-emission/document-emission.service';

/**
 * Nota de entrega — documento sin valor fiscal que justifica el traslado de
 * mercancía. Server-side: el backend lo genera al recibir el evento. Numera
 * de forma simple por ahora (timestamp); en una fase posterior puede llevar
 * correlativo formal por sucursal.
 */
export const metadata: EmissionPluginMetadata = {
  key: 'delivery_note',
  displayName: 'Nota de entrega',
  requiresLocalDriver: false,
  configSchema: {
    type: 'object',
    properties: {
      series: { type: 'string', description: 'Serie del correlativo (opcional)' },
    },
  },
};

@EventsHandler(VentaListaEvent)
export class DeliveryNoteEmissionHandler implements IEventHandler<VentaListaEvent> {
  constructor(private readonly emission: DocumentEmissionService) {}

  async handle(event: VentaListaEvent): Promise<void> {
    const cfg = await this.emission.findActive(event.terminalId, 'delivery_note');
    if (!cfg) return; // este terminal no tiene nota de entrega configurada

    const series = (cfg.configJson?.series as string) ?? 'NE';
    await this.emission.recordDocument({
      saleTicketId: event.ticketId,
      documentType: 'delivery_note',
      documentNumber: `${series}-${event.createdAt.getTime()}`,
      emissionMethodId: cfg.id,
      status: 'emitted',
    });
  }
}
