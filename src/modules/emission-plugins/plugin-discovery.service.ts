import { Inject, Injectable } from '@nestjs/common';

import { EmissionPluginMetadata } from './plugin.interface';

export const EMISSION_METADATA = Symbol('EMISSION_METADATA');

/**
 * Registro en memoria de los plugins descubiertos al boot. La metadata la
 * escanea `EmissionPluginsModule.register()` desde la carpeta `handlers/` y la
 * inyecta acá. Sirve al endpoint que lista métodos disponibles. Si un handler
 * se borra, no aparece su metadata → no se lista.
 */
@Injectable()
export class PluginDiscoveryService {
  private readonly registry = new Map<string, EmissionPluginMetadata>();

  constructor(@Inject(EMISSION_METADATA) metadata: EmissionPluginMetadata[]) {
    for (const meta of metadata) {
      if (meta?.key) this.registry.set(meta.key, meta);
    }
  }

  getAll(): EmissionPluginMetadata[] {
    return Array.from(this.registry.values());
  }

  get(key: string): EmissionPluginMetadata | undefined {
    return this.registry.get(key);
  }
}
