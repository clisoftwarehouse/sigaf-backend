import { EventsHandler, IEventHandler } from '@nestjs/cqrs';

import { EmissionPluginMetadata } from '../plugin.interface';
import { VentaListaEvent } from '../events/venta-lista.event';

/**
 * HKA fiscal — factura impresa por la máquina fiscal ACLAS PP9-PLUS.
 *
 * Es `requiresLocalDriver: true`: la impresora está físicamente en el POS y
 * tiene su propia memoria fiscal certificada. El POS imprime LOCALMENTE al
 * cobrar (online u offline) y envía el nº fiscal + control con el ticket al
 * sincronizar. SalesService registra ese documento al recibirlo.
 *
 * Por eso este handler es NO-OP sobre el evento: el documento ya quedó
 * registrado en la transacción de la venta. La metadata existe solo para que
 * el método se descubra (aparece en el endpoint y en el admin).
 */
export const metadata: EmissionPluginMetadata = {
  key: 'hka_fiscal',
  displayName: 'Factura fiscal HKA',
  requiresLocalDriver: true,
  configSchema: {
    type: 'object',
    properties: {
      port: { type: 'string', description: 'Puerto COM o ruta del dispositivo' },
      model: { type: 'string', enum: ['aclas_pp9_plus'], default: 'aclas_pp9_plus' },
    },
    required: ['port', 'model'],
  },
};

@EventsHandler(VentaListaEvent)
export class HkaFiscalEmissionHandler implements IEventHandler<VentaListaEvent> {
  async handle(): Promise<void> {
    // No-op: documento local-driver. El POS ya lo emitió e informó; el registro
    // ocurre en SalesService al persistir el ticket con sus emittedDocuments.
  }
}
