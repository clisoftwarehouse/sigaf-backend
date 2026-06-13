/**
 * Evento publicado por SalesService tras commitear una venta. El core lo
 * publica y se desentiende — NO conoce ni importa ningún handler.
 *
 * `emittedDocuments` trae los documentos que el POS YA emitió localmente
 * (ej. factura fiscal HKA impresa offline). Los handlers server-side los usan
 * para no re-emitir lo que ya existe.
 */
export class EmittedDocumentSnapshot {
  constructor(
    public readonly methodKey: string,
    public readonly documentType: string,
    public readonly documentNumber: string | null,
    public readonly controlNumber: string | null,
    public readonly status: string,
    public readonly rawResponse: Record<string, unknown> | null,
  ) {}
}

export class VentaListaEvent {
  constructor(
    public readonly ticketId: string,
    public readonly branchId: string,
    public readonly terminalId: string,
    public readonly cashierId: string | null,
    public readonly customerId: string | null,
    public readonly totalUsd: number,
    public readonly createdAt: Date,
    /** Documentos ya emitidos por el POS (local-driver). Puede venir vacío. */
    public readonly emittedDocuments: EmittedDocumentSnapshot[] = [],
  ) {}
}
