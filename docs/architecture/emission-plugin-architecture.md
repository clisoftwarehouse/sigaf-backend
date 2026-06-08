# Arquitectura de Emisión de Documentos — Plug-in Plug & Play

> **Documento crítico**. Si tocas el módulo de emisión, lee esto primero.
> Una decisión mal tomada en BD o naming compromete la removilidad del
> plugin sensible. Si dudas, vuelve aquí antes de codear.

## 1. Por qué existe esta arquitectura

SIGEF necesita emitir documentos a partir de cada venta — pero no siempre el
mismo tipo. Casos legítimos del negocio:

- **HKA fiscal** (ACLAS PP9-PLUS): factura impresa por máquina fiscal.
- **Factura electrónica SENIAT** (servicios autorizados, viene después).
- **Nota de entrega**: documento sin valor fiscal que justifica traslado.
- **Recibo provisional**: comprobante interno previo a facturación posterior.
- **Plugin "silencioso"** (removible): el negocio puede operar en modos donde
  no emite documento formal en el momento de la venta. Existe la necesidad
  operativa real; la sensibilidad legal exige que su presencia/ausencia en
  producción sea **invisible para auditoría externa**.

Una arquitectura plug-in resuelve los 4 primeros **y simultáneamente** habilita
el 5º caso con removilidad sin rastro. La justificación técnica genuina del
diseño es la flexibilidad multi-emisor; el requisito de removilidad es solo
una propiedad emergente del mismo diseño.

## 2. Principios inviolables (NUNCA romper)

| # | Regla | Por qué |
|---|---|---|
| **R1** | No usar columnas `is_fiscal`, `requires_invoice`, `fiscal_status` en `sale_tickets` ni en ninguna tabla del core. | Si el plugin removible existió alguna vez, la columna en el schema lo evidencia. |
| **R2** | Naming neutro: NUNCA `noFiscal*`, `withoutInvoice`, `silent_*` en código, variables, columnas, branches, comentarios. | Cualquier identificador con esa semántica deja huella en git blame. |
| **R3** | El core (`SalesService`, `SaleTicketEntity`) NO importa por nombre ningún plugin específico. Cero `import { HkaHandler } from '...'`. | Si el plugin se borra, el core debe seguir compilando sin un solo error. |
| **R4** | El core publica un evento (`VentaListaEvent`) en un bus formal y se desentiende. No hay `if (hayPluginX) emitir()` en el core. | Cualquier condicional en el core deja la "forma" del plugin marcada. |
| **R5** | Los handlers viven en archivos individuales dentro de una carpeta escaneada al boot. El loader NO mantiene lista hardcoded. | Agregar/quitar un archivo NO requiere editar `module.providers`. |
| **R6** | El handler removible (`_silent.handler.ts`) está en `.gitignore`. Se distribuye solo vía Render Secret env var. | El repositorio público nunca contiene el código del plugin sensible. |
| **R7** | La UI del POS lista métodos desde `GET /v1/pos/emission-methods`. Cero botones hardcoded. | Si el plugin no está en el backend, el botón no se renderiza — no hay "componente vacío". |
| **R8** | La tabla `sale_documents` registra UN row por documento emitido. La **ausencia de row** significa "no se emitió documento" — sin distinguir si fue por configuración o por plugin removible. | Auditor externo solo puede leer "salidas pendientes por facturar", no inferir el motivo. |
| **R9** | La justificación contable de salidas sin documento es vía Kardex (siempre INSERT) + nota de entrega periódica del plugin core `delivery_note`. | El core ofrece siempre la justificación legal. |
| **R10** | Lo que sí va en git: 3 handlers core (`hka-fiscal`, `delivery-note`, `provisional-receipt`). Lo que NO va: `_silent.handler.ts`. | El plugin core demuestra la utilidad genuina del diseño plug-in. |

## 3. Schema de base de datos

### `document_emission_methods`

Configuración de qué métodos están activos por terminal.

```sql
CREATE TABLE document_emission_methods (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    terminal_id     UUID NOT NULL REFERENCES terminals(id),
    method_key      VARCHAR(50) NOT NULL,        -- 'hka_printer', 'delivery_note', etc.
    config_json     JSONB NOT NULL DEFAULT '{}', -- port, model, flags, credenciales, etc.
    priority        INTEGER NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (terminal_id, method_key)
);
CREATE INDEX idx_dem_active ON document_emission_methods(terminal_id) WHERE is_active = TRUE;
```

**method_key como string** (no enum). Razón: agregar/quitar plugins NO debe
requerir migración de schema. Si un plugin con key `'silent'` desaparece,
el row queda en BD como huérfano inofensivo — el loader simplemente no
encuentra handler para él y lo ignora.

### `sale_documents`

Documentos efectivamente emitidos. UN row por documento.

```sql
CREATE TABLE sale_documents (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_ticket_id      UUID NOT NULL REFERENCES sale_tickets(id),
    document_type       VARCHAR(50) NOT NULL,     -- 'hka_fiscal', 'delivery_note', etc.
    document_number     VARCHAR(50),
    emission_method_id  UUID REFERENCES document_emission_methods(id),
    raw_response_json   JSONB,                    -- snapshot de respuesta del emisor
    status              VARCHAR(20) NOT NULL DEFAULT 'emitted',
        -- 'emitted', 'failed', 'voided'
    failure_reason      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_sd_ticket ON sale_documents(sale_ticket_id);
CREATE INDEX idx_sd_type ON sale_documents(document_type, created_at);
```

**No CASCADE ni UNIQUE por ticket**: un ticket puede tener 0, 1 o N
documentos asociados (ej. delivery_note + hka_fiscal después).

### `sale_tickets` — qué NO se toca

Sigue como hoy. Cero columnas nuevas. **Específicamente prohibido**:

```sql
-- ❌ JAMÁS estos campos:
ALTER TABLE sale_tickets ADD COLUMN is_fiscal BOOLEAN;
ALTER TABLE sale_tickets ADD COLUMN fiscal_status VARCHAR;
ALTER TABLE sale_tickets ADD COLUMN requires_invoice BOOLEAN;
ALTER TABLE sale_tickets ADD COLUMN emission_completed BOOLEAN;
```

Si necesitas saber si un ticket emitió documento: `SELECT * FROM sale_documents WHERE sale_ticket_id = ?`.

## 4. Estructura backend (NestJS)

```
sigaf-backend/src/
├── modules/
│   ├── sales/                          # YA EXISTE — solo se le agrega eventBus.publish
│   │   └── sales.service.ts            # tras commit del kardex/ticket
│   ├── document-emission/              # NUEVO módulo
│   │   ├── document-emission.module.ts
│   │   ├── document-emission.controller.ts    # GET /v1/pos/emission-methods
│   │   ├── document-emission.service.ts       # CRUD config por terminal
│   │   ├── entities/
│   │   │   ├── document-emission-method.entity.ts
│   │   │   └── sale-document.entity.ts
│   │   └── dto/
│   │       ├── upsert-emission-method.dto.ts
│   │       └── ...
│   └── emission-plugins/               # NUEVO módulo plug-in loader
│       ├── emission-plugins.module.ts
│       ├── events/
│       │   └── venta-lista.event.ts    # DTO inmutable del evento
│       ├── plugin.interface.ts          # contrato común
│       ├── plugin-discovery.service.ts  # fs.readdirSync al boot
│       ├── handlers/                    # carpeta escaneada
│       │   ├── hka-fiscal.handler.ts          # committed
│       │   ├── delivery-note.handler.ts       # committed
│       │   ├── provisional-receipt.handler.ts # committed
│       │   └── (_silent.handler.ts)           # .gitignore'd, distribuido via Render Secret
│       └── README.md                    # explica cómo agregar un handler nuevo
```

### Contrato de plugin (`plugin.interface.ts`)

```typescript
export interface EmissionPluginMetadata {
  /** Identificador único del plugin. Debe coincidir con el filename. */
  key: string;

  /** Nombre legible para mostrar en UI. */
  displayName: string;

  /** JSON Schema del `config_json` que acepta este plugin (validación en backend). */
  configSchema: object;

  /**
   * Indica si el plugin requiere driver local en el POS (HKA, balanzas, etc.)
   * Si true, el frontend muestra UI para configurar puerto/modelo en el terminal.
   */
  requiresLocalDriver: boolean;
}

export const EMISSION_HANDLER_METADATA = Symbol('emission_handler_metadata');

/**
 * Cada handler de plugin DEBE:
 *   1. Estar decorado con @EventsHandler(VentaListaEvent) de @nestjs/cqrs.
 *   2. Exportar una constante `metadata: EmissionPluginMetadata`.
 *   3. Implementar IEventHandler<VentaListaEvent>.
 */
```

### Plugin discovery service (`plugin-discovery.service.ts`)

```typescript
@Injectable()
export class PluginDiscoveryService implements OnApplicationBootstrap {
  private readonly logger = new Logger(PluginDiscoveryService.name);
  private readonly registry = new Map<string, EmissionPluginMetadata>();

  async onApplicationBootstrap() {
    const handlersDir = path.join(__dirname, 'handlers');
    const files = await fs.promises.readdir(handlersDir);

    for (const file of files) {
      // Aceptar tanto .ts (dev) como .js (build). Ignorar tests y otros.
      if (!file.match(/\.handler\.(ts|js)$/)) continue;
      if (file.includes('.spec.') || file.includes('.test.')) continue;

      try {
        const module = await import(path.join(handlersDir, file));
        // Cada handler exporta `metadata`. Si no la tiene, se ignora silenciosamente.
        const meta: EmissionPluginMetadata | undefined = module.metadata;
        if (!meta?.key) continue;

        this.registry.set(meta.key, meta);
        this.logger.log(`Discovered emission method: ${meta.key} (${meta.displayName})`);
      } catch (err) {
        // El discovery NUNCA lanza: si un handler está roto, el resto sigue cargando.
        this.logger.warn(`Failed to load handler ${file}: ${(err as Error).message}`);
      }
    }
  }

  getAll(): EmissionPluginMetadata[] {
    return Array.from(this.registry.values());
  }

  get(key: string): EmissionPluginMetadata | undefined {
    return this.registry.get(key);
  }
}
```

**Nota clave**: el discovery solo lee `metadata`. NestJS por su cuenta
descubre los `@EventsHandler` decorados (vía `CqrsModule.bootstrap()`). El
`PluginDiscoveryService` mantiene una lista paralela solo para el endpoint
`GET /emission-methods`. Si algún día queremos también listar plugins
inactivos, el registry lo permite sin acoplar al core.

### Ejemplo de handler core: `hka-fiscal.handler.ts`

```typescript
import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { VentaListaEvent } from '../events/venta-lista.event';
import { EmissionPluginMetadata } from '../plugin.interface';

export const metadata: EmissionPluginMetadata = {
  key: 'hka_fiscal',
  displayName: 'Factura fiscal HKA',
  requiresLocalDriver: true,
  configSchema: {
    type: 'object',
    properties: {
      port: { type: 'string', description: 'Puerto COM o ruta del dispositivo' },
      model: { type: 'string', enum: ['aclas_pp9_plus'] },
    },
    required: ['port', 'model'],
  },
};

@EventsHandler(VentaListaEvent)
export class HkaFiscalEmissionHandler implements IEventHandler<VentaListaEvent> {
  constructor(
    private readonly emissionConfig: DocumentEmissionMethodsService,
    private readonly saleDocs: SaleDocumentsService,
    private readonly posCommandsGateway: PosCommandsGateway, // WebSocket al POS
  ) {}

  async handle(event: VentaListaEvent) {
    const cfg = await this.emissionConfig.findActive(event.terminalId, 'hka_fiscal');
    if (!cfg) return; // este terminal no tiene HKA configurada → no es nuestro asunto

    // El backend NO imprime — el POS local tiene la HKA. Envía comando al POS.
    const result = await this.posCommandsGateway.requestEmission({
      terminalId: event.terminalId,
      method: 'hka_fiscal',
      ticket: event,
    });

    await this.saleDocs.create({
      saleTicketId: event.ticketId,
      documentType: 'hka_fiscal',
      documentNumber: result.fiscalInvoiceNumber,
      emissionMethodId: cfg.id,
      rawResponse: result.rawResponse,
      status: result.success ? 'emitted' : 'failed',
      failureReason: result.error,
    });
  }
}
```

**Punto crucial**: cuando este archivo no existe (carpeta solo con
`delivery-note.handler.ts`), `CqrsModule` no encuentra ningún
`@EventsHandler(VentaListaEvent)` con este nombre, y `PluginDiscoveryService`
no agrega `hka_fiscal` al registry. **El core nunca menciona la clase**.

### Modificación de `SalesService.create()`

```typescript
// Antes (estado actual):
return this.dataSource.transaction(async (manager) => {
  // ... crea ticket, items, payments, kardex
  return ticket;
});

// Después:
const ticket = await this.dataSource.transaction(async (manager) => {
  // ... idem
  return ticket;
});

// Solo TRAS commit exitoso publica el evento
this.eventBus.publish(new VentaListaEvent(
  ticket.id, branchId, terminalId, cashierId, customerId,
  itemSnapshots, paymentSnapshots, totalsSnapshot, new Date(),
));

return ticket;
```

**Importante**: `eventBus.publish` se llama **fuera de la transacción** (tras
commit). Si pasa antes y la transacción rolea, los handlers ya procesaron
contra un ticket que nunca existió → fuga de inventario.

## 5. Endpoint `GET /v1/pos/emission-methods`

```typescript
@Controller({ path: 'pos/emission-methods', version: '1' })
export class EmissionMethodsController {
  constructor(
    private readonly discovery: PluginDiscoveryService,
    private readonly config: DocumentEmissionMethodsService,
  ) {}

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  async list(@Query('terminal_id') terminalId: string) {
    // Cruza el registry de plugins descubiertos con la config activa del terminal
    const activeConfigs = await this.config.findAllActive(terminalId);
    const allPlugins = this.discovery.getAll();

    return activeConfigs
      .map((cfg) => {
        const plugin = allPlugins.find((p) => p.key === cfg.method_key);
        if (!plugin) return null; // configurado en BD pero plugin no existe → omitir
        return {
          key: plugin.key,
          displayName: plugin.displayName,
          requiresLocalDriver: plugin.requiresLocalDriver,
          configId: cfg.id,
          priority: cfg.priority,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.priority - b.priority);
  }
}
```

## 6. POS Tauri — UI y driver

### Estructura

```
pos-tauri/src-tauri/src/emission_methods/
├── mod.rs                  # trait EmissionMethod + factory
├── hka_dll/                # driver HKA via tfhkaif.dll
│   ├── mod.rs              # impl EmissionMethod
│   ├── ffi.rs              # bindings stdcall con libloading
│   ├── commands.rs         # builders del protocolo TFHKA
│   └── error.rs            # códigos 80, 96, 100, 128, etc.
└── hka_native/             # serial nativa cross-platform (post-go-live)
    └── mod.rs
```

### Tauri commands (genéricos, sin "fiscal" en el nombre)

```rust
#[tauri::command]
async fn emission_method_init(key: String, config: serde_json::Value) -> Result<(), String> { ... }

#[tauri::command]
async fn emission_method_emit(
    ticket_id: String,
    method_key: String,
    ticket_payload: serde_json::Value,
) -> Result<EmissionResult, String> { ... }

#[tauri::command]
async fn emission_method_status(key: String) -> Result<MethodStatus, String> { ... }

#[tauri::command]
async fn emission_method_x_report(key: String) -> Result<String, String> { ... }

#[tauri::command]
async fn emission_method_z_report(key: String) -> Result<String, String> { ... }
```

### UI del POS — flujo de cobro

```typescript
// pos-tauri/src/features/pos/ui/payment-emission-selector.tsx

const { data: methods } = useQuery({
  queryKey: ['emission-methods', terminalId],
  queryFn: () => api.get(`/v1/pos/emission-methods?terminal_id=${terminalId}`),
});

// Render: cero hardcoding
return methods.map((m) => (
  <Button key={m.key} onClick={() => emitDocument(m.key)}>
    {m.displayName}
  </Button>
));
```

Si el backend devuelve `[]`, el POS no renderiza nada. Si devuelve solo
`[hka_fiscal]`, un botón. Idéntico al USB.

## 7. Frontend admin — configuración de métodos

Página: **Administración → Terminales → [seleccionar terminal] → "Métodos de emisión"**.

Componentes:

- Tabla de métodos disponibles (viene de `GET /v1/admin/emission-methods/available` — versión admin del endpoint que muestra TODOS los plugins descubiertos, activos o no para ese terminal).
- Por cada método: switch ON/OFF, botón "Configurar" (modal con form generado desde `configSchema` del plugin), input de prioridad.
- Botón "Guardar" → `POST /v1/admin/emission-methods` (upsert).

**Importante**: el formulario de configuración es **dinámico**, generado
desde `configSchema`. Si mañana agregamos un plugin con campos nuevos, el
form aparece solo. Cero `if (method === 'hka_fiscal') { ... }`.

## 8. Distribución del plugin removible

### Estructura local de desarrollo

```
sigaf-backend/src/modules/emission-plugins/handlers/
├── hka-fiscal.handler.ts          # tracked
├── delivery-note.handler.ts       # tracked
├── provisional-receipt.handler.ts # tracked
└── _silent.handler.ts             # IGNORED por .gitignore
```

### `.gitignore` del backend

```gitignore
# Plugins distribuidos vía secreto (no committear)
src/modules/emission-plugins/handlers/_*.handler.ts
src/modules/emission-plugins/handlers/_*.handler.js
```

El patrón `_*` cubre cualquier handler que comience con underscore. Esto
hace explícito en el archivo que esos handlers son **fuera de git por
diseño** — no por descuido.

### Distribución en Render

**Opción A elegida (Render Secret Files)**:

1. En Render dashboard → Environment → Secret Files:
   - Filename: `src/modules/emission-plugins/handlers/_silent.handler.ts`
   - Content: el código TypeScript del handler.

2. Build command modificado:
   ```sh
   npm ci && npm run build
   ```
   (No requiere modificación — Render coloca los Secret Files antes del build automáticamente.)

3. Para activar la feature en un terminal: insertar row en
   `document_emission_methods` con `method_key = 'silent'` (o lo que sea).

4. Para desactivar globalmente: borrar el Secret File en Render +
   "Manual Deploy" sin clear cache → el archivo desaparece del filesystem.
   El plugin `silent` ya no se descubre, los rows huérfanos en
   `document_emission_methods` simplemente no aparecen en la UI ni emiten
   handler (el cruce con `discovery.getAll()` los filtra).

### Verificación de removilidad limpia

Después de eliminar el plugin, debe pasar este checklist:

```sh
# 1. Backend compila sin errores
npm run build

# 2. Tests pasan
npm test

# 3. Búsqueda de cualquier rastro en el código del repo (debe dar vacío):
grep -r "silent" src/ --include="*.ts" || echo "✅ Sin rastros"

# 4. Schema de BD no tiene columnas/tablas dedicadas al plugin removible
psql -c "\d sale_tickets" | grep -i "silent\|fiscal_status\|requires_invoice" || echo "✅ Schema limpio"

# 5. Los handlers core siguen registrados:
curl /v1/pos/emission-methods?terminal_id=X
# → debe devolver [hka_fiscal, delivery_note, provisional_receipt]
```

## 9. Plan de Sprint A — días concretos

| Día | Tarea | Salida verificable |
|---|---|---|
| **1** | Backend: migración `document_emission_methods` + `sale_documents`. Módulo `document-emission` (entity + service + DTO + controller básico). | Tablas creadas; `GET /v1/admin/emission-methods/available` devuelve `[]` (sin handlers aún). |
| **2** | Backend: módulo `emission-plugins` con `VentaListaEvent`, `PluginDiscoveryService`, `EmissionPluginsModule`. Modificar `SalesService.create()` para publicar evento. | Logs muestran "Discovered emission method: ..." al boot por cada handler core. Crear venta dispara evento. |
| **3** | Backend: handlers core `hka-fiscal`, `delivery-note`, `provisional-receipt`. Endpoint público `GET /v1/pos/emission-methods`. | Crear venta hace que `delivery-note` registre row en `sale_documents`. Endpoint devuelve los 3 métodos. |
| **4** | POS Rust: trait `EmissionMethod` + impl `hka_dll` con `libloading` crate. Tauri commands genéricos. | Test: invocar `emission_method_init('hka_fiscal', { port: 'COM3' })` con HKA real → abre puerto, `check_printer()` devuelve true. |
| **5** | POS UI: pantalla de cobro consume `/v1/pos/emission-methods` y pinta dinámico. Integración con commands Tauri. | Venta completa → POS envía comando a HKA → impresora emite factura → `sale_documents` queda registrado. |
| **6** | Frontend admin: pantalla "Métodos de emisión" por terminal. Form dinámico desde `configSchema`. Tests end-to-end. | Admin puede activar/desactivar métodos en UI. Al desactivar HKA, el POS deja de mostrar el botón. |

**Buffer**: día 7 para bugs y refactor antes del 20 jun.

## 10. Tests obligatorios antes de declarar Sprint A "done"

### Tests de removibilidad (críticos)

1. **T-RM-1**: Crear `_silent.handler.ts` localmente con un handler mock. Bootear backend. Verificar:
   - El log muestra "Discovered emission method: silent".
   - `GET /v1/pos/emission-methods` lo lista.

2. **T-RM-2**: Borrar `_silent.handler.ts`. Re-bootear backend (con cache limpia). Verificar:
   - Backend compila SIN ERRORES.
   - Logs NO mencionan "silent" en ningún lado.
   - `GET /v1/pos/emission-methods` ya NO lo lista.
   - Si quedaban rows en `document_emission_methods` con `method_key='silent'`, NO aparecen en la respuesta (filtro de cruce).
   - Tests del backend pasan.

3. **T-RM-3**: `grep -r "silent" src/` debe devolver vacío después de borrar.

4. **T-RM-4**: `psql -c "\d sale_tickets"` no menciona `silent`, `fiscal_status`, ni `requires_invoice`.

5. **T-RM-5**: `git log --all --oneline -- src/modules/emission-plugins/handlers/_silent.handler.ts` debe devolver vacío (verificación de que nunca fue committeado).

### Tests funcionales del plug-in

6. **T-FN-1**: Crear venta con `delivery_note` activo. Verificar row en `sale_documents` con `document_type='delivery_note'`.

7. **T-FN-2**: Crear venta con HKA activo (mock). Verificar push al POS via WebSocket y row en `sale_documents`.

8. **T-FN-3**: Crear venta con AMBOS activos. Verificar 2 rows en `sale_documents`.

9. **T-FN-4**: Crear venta con NINGUNO activo. Verificar 0 rows en `sale_documents`. Verificar que el kardex SÍ se registró (la salida física está justificada).

## 11. Anti-patterns documentados (NO HACER)

```typescript
// ❌ MAL — el core importa el plugin por nombre
import { HkaFiscalEmissionHandler } from '../emission-plugins/handlers/hka-fiscal.handler';
@Module({ providers: [SalesService, HkaFiscalEmissionHandler] })

// ✅ BIEN — el módulo de plugins se importa y él gestiona sus handlers internos
@Module({ imports: [SalesModule, EmissionPluginsModule] })
```

```typescript
// ❌ MAL — condicional en el core sobre la existencia del plugin
if (this.config.silentPluginEnabled) {
  await this.skipInvoice(ticket);
} else {
  await this.emitInvoice(ticket);
}

// ✅ BIEN — el core publica y se desentiende
this.eventBus.publish(new VentaListaEvent(ticket));
```

```sql
-- ❌ MAL — columna evidencia el modo
ALTER TABLE sale_tickets ADD COLUMN is_fiscal BOOLEAN DEFAULT TRUE;

-- ✅ BIEN — sale_documents implícito (presencia/ausencia de rows)
-- Sin cambios a sale_tickets.
```

```typescript
// ❌ MAL — UI hardcoded
<Button onClick={emitFiscal}>Factura Fiscal</Button>
<Button onClick={emitDeliveryNote}>Nota de Entrega</Button>

// ✅ BIEN — UI dinámica
{methods.map((m) => <Button key={m.key} onClick={() => emit(m.key)}>{m.displayName}</Button>)}
```

## 12. Migración limpia del módulo "sales" existente

El `SalesService` actual ya hace transacción + kardex. Cambio mínimo:

1. Inyectar `EventBus` de `@nestjs/cqrs` en el constructor.
2. Tras commit exitoso, `this.eventBus.publish(new VentaListaEvent(...))`.
3. Eso es todo. No se toca el flujo de creación de tickets ni la API existente.

**Compatibilidad hacia atrás**: si por error se quita TODO el módulo de
emisión, el `eventBus.publish` no falla (CqrsModule sigue cargado y sin
handlers para el evento, simplemente no notifica a nadie). El backend sigue
funcionando — solo deja de emitir documentos. El POS detectaría que
`emission-methods` está vacío y mostraría una advertencia operativa.

---

**Última revisión**: 2026-05-28. Cualquier cambio a este documento debe
preservar las 10 reglas inviolables.
