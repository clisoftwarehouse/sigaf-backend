# Handlers de emisión de documentos

Cada archivo `*.handler.ts` en esta carpeta es un plugin de emisión que se
**descubre automáticamente** al boot (`EmissionPluginsModule.register()` escanea
la carpeta). No hay lista hardcodeada ni imports en el core.

## Agregar un método

1. Crear `mi-metodo.handler.ts`.
2. Exportar `metadata: EmissionPluginMetadata` (key, displayName, configSchema, requiresLocalDriver).
3. Exportar una clase `XxxHandler` decorada con `@EventsHandler(VentaListaEvent)`
   que implemente `IEventHandler<VentaListaEvent>`.
4. Reiniciar. El log muestra el método descubierto y aparece en
   `GET /v1/pos/emission-methods` / admin.

## Quitar un método

Borrar el archivo y reiniciar. Desaparece de los providers, del registro y del
evento. **Sin imports huérfanos, sin condicionales en el core, sin rastro.**

## Convenciones

- `requiresLocalDriver: true` → el documento lo emite un driver local del POS
  (HKA, etc.). El handler del backend es no-op; el POS reporta el resultado y
  SalesService lo registra al sincronizar el ticket.
- `requiresLocalDriver: false` → el backend genera el documento en el handler.
- Los archivos que empiezan con `_` están en `.gitignore` (distribución fuera
  del repo). El patrón `_*.handler.ts` es removible sin dejar rastro en git.
