import { join } from 'path';
import { readdirSync } from 'fs';
import { CqrsModule } from '@nestjs/cqrs';
import { Module, Provider, DynamicModule } from '@nestjs/common';

import { EmissionPluginMetadata } from './plugin.interface';
import { TerminalsModule } from '../terminals/terminals.module';
import { DocumentEmissionModule } from '../document-emission/document-emission.module';
import { EMISSION_METADATA, PluginDiscoveryService } from './plugin-discovery.service';
import {
  PosEmissionMethodsController,
  AdminEmissionMethodsController,
} from '../document-emission/document-emission.controller';

/**
 * Escanea la carpeta `handlers/` y recoge, por cada archivo `*.handler.{js,ts}`:
 *   - la clase exportada cuyo nombre termina en `Handler` (para registrarla
 *     como provider y que CqrsModule la cablee como @EventsHandler),
 *   - su `metadata` (para el endpoint que lista métodos disponibles).
 *
 * Borrar un archivo de handler lo elimina de TODO: no se registra provider, no
 * se descubre metadata, no se cablea el evento. Sin imports hardcoded en el
 * core, sin rastro. Agregar uno nuevo = soltar el archivo y reiniciar.
 */
function discoverHandlers(): { providers: Provider[]; metadata: EmissionPluginMetadata[] } {
  const dir = join(__dirname, 'handlers');
  const providers: Provider[] = [];
  const metadata: EmissionPluginMetadata[] = [];

  let files: string[] = [];
  try {
    files = readdirSync(dir);
  } catch {
    return { providers, metadata };
  }

  for (const file of files) {
    if (!/\.handler\.(js|ts)$/.test(file)) continue;
    if (file.includes('.spec.') || file.endsWith('.d.ts')) continue;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(dir, file));
    if (mod.metadata?.key) metadata.push(mod.metadata as EmissionPluginMetadata);
    for (const exported of Object.values(mod)) {
      if (typeof exported === 'function' && /Handler$/.test((exported as { name: string }).name)) {
        providers.push(exported as Provider);
      }
    }
  }

  return { providers, metadata };
}

@Module({})
export class EmissionPluginsModule {
  static register(): DynamicModule {
    const { providers, metadata } = discoverHandlers();
    return {
      module: EmissionPluginsModule,
      imports: [CqrsModule, DocumentEmissionModule, TerminalsModule],
      controllers: [PosEmissionMethodsController, AdminEmissionMethodsController],
      providers: [{ provide: EMISSION_METADATA, useValue: metadata }, PluginDiscoveryService, ...providers],
      exports: [PluginDiscoveryService],
    };
  }
}
