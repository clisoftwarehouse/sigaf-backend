/**
 * Metadata que cada plugin de emisión expone para descubrimiento dinámico.
 *
 * El loader escanea la carpeta `handlers/` y registra cada archivo que exporte
 * una `metadata`. Borrar el archivo del handler → desaparece del registro, del
 * endpoint y de los providers, sin imports huérfanos ni rastro en el core.
 */
export interface EmissionPluginMetadata {
  /** Identificador único. Coincide con el filename (ej. 'hka_fiscal'). */
  key: string;

  /** Nombre legible para la UI. */
  displayName: string;

  /** JSON Schema del config_json que acepta este plugin (validación + form admin). */
  configSchema: object;

  /**
   * true si el documento lo emite un driver LOCAL del POS (HKA, tickera).
   * El backend no emite; solo registra el resultado que el POS le envía.
   * false → el backend genera el documento server-side en el handler.
   */
  requiresLocalDriver: boolean;
}
