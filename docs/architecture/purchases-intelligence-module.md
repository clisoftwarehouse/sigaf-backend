# Módulo Inteligente de Compras — Plan de Refactor

> Plan derivado del PRD `modulo_compras/prd-compras-farmacia (1).docx` (v1.0,
> mayo 2026) y del mockup `modulo_compras/demo-compras-farmacia.html`.
> Adaptado a nuestro stack NestJS + TypeORM + Postgres (Neon) en lugar del
> Next.js + Prisma + SQLite que propone el PRD.

## 1. Visión

Sustituir el módulo de compras actual (que es transaccional: OC + recepción)
por un **módulo inteligente de compras** que responde una sola pregunta:

> *"¿Qué debo comprar, cuánto, a quién, bajo qué condición, con qué margen
> y por qué?"*

El sistema clasifica cada producto en categorías A, B, C, D usando 5
dimensiones (rotación 35%, Pareto 25%, margen sano 20%, días inventario 15%,
vencimiento próximo 5%), descompone el costo en 5 capas de descuento en 3
escenarios (conservador, comercial, financiero), y produce un sugerido de
compra con score 0-100. Los productos C/D aparecen marcados en el portafolio
para acción del comprador (sin workflows formales con estados — el comprador
filtra y actúa directamente).

> **Recorte 2026-05-28**: El PRD original definía workflows de dinamización
> (C) y descodificación (D) con estados (`in_negotiation`, `approved_by_provider`,
> `closed_success`, etc.), tablas de audit-log, snapshot de cada corrida del
> sugerido y cron diario. **Todo eso quedó fuera**. Productos C/D se marcan
> con badge en el portafolio; descodificar = `isActive=false`. Sugerido siempre
> on-demand. Score de 5 dimensiones (no 7). Detalle en
> `memory/project_purchases_intelligence.md` sección "Recorte aplicado".

## 2. Restricciones del refactor

### Stack — mantenemos el nuestro

| Capa | PRD propone | Nosotros usamos |
|---|---|---|
| Backend | Next.js full-stack | **NestJS + TypeORM** (existente) |
| Frontend | Server components Next.js | **React + MUI + react-query** (existente) |
| BD | SQLite local con Prisma | **Postgres (Neon)** con TypeORM (existente) |
| Auth | jose + JWT | **@nestjs/passport + JWT** (existente) |

El PRD es la **funcionalidad**, no el stack. Adaptamos sin pérdida.

### POS — NO se toca

El POS lee `products`, `prices`, `inventory_lots` para vender, y escribe
`sale_tickets` + `kardex`. **Nada de eso cambia** con este refactor. Las
tablas nuevas (`drugstore_conditions`, `lab_conditions`, `classification_history`,
`dynamization_alerts`, `decoding_requests`, etc.) son consumidas solo por
el admin web.

Verificación: grep de `purchas|orders|receipts|claims` en `pos-tauri/src`
da solo falsos positivos (componentes UI MUI con esos nombres).

### Una sola empresa — fuera de alcance todo lo SaaS

El PRD viene redactado como producto comercial para venderse a múltiples
farmacias en formato SaaS. **Nuestro proyecto es para UN solo cliente**
(una empresa farmacéutica con sus sucursales). Queda **fuera del alcance**:

- ❌ `empresaId` / `companyId` / `tenantId` en tablas — no existe el concepto
- ❌ Onboarding self-service de nuevas empresas
- ❌ Plan de precios por sucursal/SKU
- ❌ Marketplace de productos descodificados entre farmacias
- ❌ Dataset agregado anónimo
- ❌ Migración futura a SaaS multi-empresa
- ❌ Fases 3-5 del roadmap del PRD (todo lo SaaS / ML / integraciones API droguerías / WhatsApp Business / app móvil)
- ❌ Pronósticos con regresión / ML avanzado
- ❌ Recomendaciones automáticas de sustitución cuando un producto entra en descodificación
- ❌ Comparativos contra benchmarks anónimos
- ❌ Notificaciones por correo/WhatsApp

`branchId` ya existe en el sistema y representa **sucursales operativas
del mismo cliente** — NO es un tenant. Las consultas filtran por sucursal
cuando aplica (por ejemplo, el sugerido se calcula por sucursal porque
cada una tiene stock y demanda propios), pero todas las sucursales
comparten un único catálogo, proveedores, condiciones comerciales, etc.

### Roles — usamos los del sistema existente

El PRD define 4 roles propios (administrador, comprador, gerente,
auditor). Nuestro sistema ya tiene un esquema RBAC granular con permission
codes vigente. Mapeo:

| Rol del PRD | Rol del sistema actual |
|---|---|
| Administrador | `administrador` (acceso total, bypass del PermissionsGuard) |
| Comprador | `gerente_inventario` (con permisos de compras) |
| Gerente | `administrador` o `gerente_inventario` con permission extra para aprobar descodificaciones |
| Auditor | rol de solo lectura — fuera del alcance ahora; auditoría se cubre con el módulo `audit_log` existente |

NO creamos un rol `comprador` nuevo. Reutilizamos `gerente_inventario` que
ya tiene los permisos de catálogo + inventario + compras.

## 3. Gap analysis — qué existe vs qué falta

### Existente en backend (~30% del PRD)

| Entidad PRD | Estado actual |
|---|---|
| `Producto` | ✅ `ProductEntity` completo (stockMin/max, leadTime, pmvp, taxType, etc.) |
| `Laboratorio` | ✅ `BrandEntity.isLaboratory` |
| `Droguería` | 🟡 `SupplierEntity.isDrugstore` (existe el flag pero la lógica de "droguería vs proveedor general" no está modelada) |
| `OrdenCompra` + items | ✅ `PurchaseOrderEntity` + `PurchaseOrderItemEntity` |
| `GoodsReceipt` | ✅ Recepción con reapprove + claims |
| `Venta` histórica | ✅ `SaleTicketEntity` + items (POS) |
| `ListaPreciosDrogueria` | 🟡 `SupplierProductEntity` (limitado: cost_usd + last_cost_usd + discount_pct lineal — falta disponibilidad/cantidad ofrecida/vencimiento del lote) |
| `Importacion` | ✅ `imports` module genérico, extensible |

### Faltante (~50% del PRD, tras recorte 2026-05-28)

| Entidad/Feature PRD | Notas |
|---|---|
| `CondicionDrogueria` (cabecera, volumen, pronto pago) | Tabla nueva con scope opcional por producto/laboratorio |
| `CondicionLaboratorio` (lineal, escala por unidades) | Tabla nueva con scope opcional por producto |
| Motor de cálculo de costo neto en 3 escenarios (conservador / comercial / financiero) | Servicio nuevo con funciones puras testeables |
| Motor ABCD recortado: reglas duras + score ponderado **5 dim** (35 rotación + 25 Pareto + 20 margen + 15 días inv + 5 vencimiento) | Servicio on-demand (botón "Recalcular"); sin cron |
| Pareto: 50% unidades + 50% margen monetario, acumulado hasta 80% | Sub-servicio del motor |
| Estacionalidad como **índice de ajuste opcional** del sugerido si hay 6+ meses de histórico | Sub-servicio (no entra en el score) |
| Sugerido de compra inteligente con score 0-100 — **on-demand, no se persiste** | Servicio nuevo |
| Comparador droguerías multidimensional (50% costo, 15% disponibilidad, 15% vencimiento lote, 10% crédito, 10% entrega) | Servicio nuevo |
| Marcado de C en portafolio como "candidato dinamizar" + D como "candidato descodificar" | Computado on-demand, sin tabla de workflow |
| Dashboard ejecutivo con KPIs | UI nueva (básico) |
| Portafolio ABCD navegable (con filtros C/D) | UI nueva |
| 4 vistas admin nuevas (Dashboard, Sugerido, Portafolio, Condiciones) | UI nueva |

> **Quedó fuera explícitamente (recorte):** `ClasificacionHistorial` (audit
> log de categoría), `Dinamizacion` con estados de workflow + plantilla
> mensaje, `Descodificacion` con flujo aprobación + acciones liquidación,
> `PurchaseSuggestion` (snapshot de cada corrida), pantalla dedicada de
> Dinamización, pantalla dedicada de Descodificación, pantalla dedicada de
> Importar (usa el módulo `imports` existente), cron diario, generación
> automática de alertas, "apoyo del proveedor" como componente del score.

## 4. Modelo de datos — nuevas entidades

Tablas que dependen de la sucursal (stock, sugerido, classifications)
incluyen `branchId`. Tablas globales del negocio (condiciones droguería,
condiciones laboratorio, etc.) NO llevan `branchId` porque aplican a toda
la empresa. Convención: snake_case en BD, camelCase en código.

### `drugstore_conditions`

Condiciones comerciales a nivel droguería (cabecera, volumen, pronto pago).

```sql
CREATE TABLE drugstore_conditions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supplier_id         UUID NOT NULL REFERENCES suppliers(id),

    -- Scope opcional: si product_id o brand_id están seteados, la condición
    -- aplica solo a ese subconjunto. Si ambos NULL, aplica a toda la droguería.
    product_id          UUID REFERENCES products(id),
    brand_id            UUID REFERENCES brands(id),  -- aplica a todos los productos de un laboratorio

    -- Capas (porcentajes 0-100; multiplicativas, no aditivas)
    cabecera_pct        NUMERIC(5,2) NOT NULL DEFAULT 0,
    volumen_pct         NUMERIC(5,2) NOT NULL DEFAULT 0,
    pronto_pago_pct     NUMERIC(5,2) NOT NULL DEFAULT 0,

    -- Umbrales para volumen
    volumen_min_usd     NUMERIC(18,4),    -- compra > X USD activa el descuento
    volumen_min_units   NUMERIC(12,3),    -- O compra > X unidades

    -- Crédito y entrega
    credit_days         SMALLINT DEFAULT 30,
    delivery_days       SMALLINT DEFAULT 2,

    valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to            DATE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_dc_supplier ON drugstore_conditions(supplier_id, is_active);
CREATE INDEX idx_dc_product ON drugstore_conditions(product_id) WHERE product_id IS NOT NULL;
```

### `lab_conditions`

Condiciones comerciales a nivel laboratorio (lineal, escala).

```sql
CREATE TABLE lab_conditions (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id            UUID NOT NULL REFERENCES brands(id),  -- laboratorio
    supplier_id         UUID REFERENCES suppliers(id),        -- opcional: solo aplicable cuando se compra a esta droguería

    -- Scope opcional por producto
    product_id          UUID REFERENCES products(id),

    -- Capas (multiplicativas)
    lineal_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
    escala_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,

    -- Umbral de escala
    escala_min_units    NUMERIC(12,3),

    valid_from          DATE NOT NULL DEFAULT CURRENT_DATE,
    valid_to            DATE,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_lc_brand ON lab_conditions(brand_id, is_active);
```

### Extender `supplier_products`

Añadir disponibilidad real, cantidad ofrecida y vencimiento del lote del
proveedor (para el comparador).

```sql
ALTER TABLE supplier_products
    ADD COLUMN available_qty    NUMERIC(12,3),
    ADD COLUMN lot_number       VARCHAR(50),
    ADD COLUMN lot_expiry_date  DATE,
    ADD COLUMN price_list_updated_at TIMESTAMPTZ;
```

### `product_classifications`

Snapshot de la clasificación ABCD vigente por producto (last-value, una
sola fila por producto+sucursal — se sobrescribe en cada recálculo
on-demand).

```sql
CREATE TABLE product_classifications (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id                  UUID NOT NULL REFERENCES products(id),
    branch_id                   UUID NOT NULL REFERENCES branches(id),

    -- Clasificación
    abcd_class                  CHAR(1) NOT NULL,    -- 'A','B','C','D'
    score                       NUMERIC(5,2) NOT NULL, -- 0-100
    is_pareto                   BOOLEAN NOT NULL DEFAULT FALSE,
    forced_promotion_to_b       BOOLEAN NOT NULL DEFAULT FALSE,  -- C + Pareto → B

    -- Métricas crudas (snapshot al momento del cálculo)
    daily_velocity              NUMERIC(12,4),       -- venta/día
    days_of_inventory           NUMERIC(8,2),
    days_since_last_sale        INTEGER,
    margin_pct                  NUMERIC(5,2),
    seasonal_index_current      NUMERIC(5,3),         -- 0-2.0 (informativo)
    expiry_signal               VARCHAR(10),

    -- Score components (5 dimensiones; cada uno 0-1)
    component_rotation          NUMERIC(4,3),
    component_pareto            NUMERIC(4,3),
    component_margin            NUMERIC(4,3),
    component_inventory_days    NUMERIC(4,3),
    component_expiry            NUMERIC(4,3),

    calculated_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, branch_id)
);
CREATE INDEX idx_pc_class ON product_classifications(branch_id, abcd_class);
CREATE INDEX idx_pc_pareto ON product_classifications(branch_id) WHERE is_pareto = TRUE;
```

> **Recorte:** Las tablas `classification_history`, `dynamization_alerts`,
> `decoding_requests`, `purchase_suggestions` que originalmente estaban en
> este modelo se eliminaron. Razones documentadas en
> `memory/project_purchases_intelligence.md` y en §3 arriba.

### Extender `purchase_order_items`

Persistir la decisión + motivo + costo neto al momento de generar la OC
(viene del sugerido in-memory; NO se referencia tabla de snapshot).

```sql
ALTER TABLE purchase_order_items
    ADD COLUMN decision_at_creation   VARCHAR(30),
    ADD COLUMN reason_at_creation     TEXT,
    ADD COLUMN net_cost_usd_snapshot  NUMERIC(18,4);
```

## 5. Estructura del módulo NestJS

```
sigaf-backend/src/modules/
├── purchases/                       # YA EXISTE — mantiene OC + recepciones
│   └── ...
├── purchases-intelligence/          # NUEVO módulo
│   ├── purchases-intelligence.module.ts
│   ├── controllers/
│   │   ├── conditions.controller.ts            # CRUD drugstore/lab conditions
│   │   ├── classifications.controller.ts       # GET portafolio ABCD + POST recalcular
│   │   ├── suggestions.controller.ts           # POST generar sugerido + POST crear OCs
│   │   ├── comparator.controller.ts            # GET comparador por producto
│   │   └── purchase-dashboard.controller.ts    # GET KPIs
│   ├── entities/
│   │   ├── drugstore-condition.entity.ts
│   │   ├── lab-condition.entity.ts
│   │   └── product-classification.entity.ts
│   ├── services/
│   │   ├── conditions.service.ts
│   │   ├── classifications.service.ts          # ABCD + Pareto (persiste snapshot vigente)
│   │   ├── suggestions.service.ts              # orquestador del sugerido (on-demand, sin persistir)
│   │   ├── comparator.service.ts
│   │   └── purchase-dashboard.service.ts
│   ├── engine/                       # núcleo aislado, funciones puras testeables
│   │   ├── README.md                 # explica que NO debe importar Repos
│   │   ├── net-cost.calculator.ts    # 5 capas × 3 escenarios
│   │   ├── rotation.calculator.ts    # daily_velocity, days_of_inventory
│   │   ├── pareto.calculator.ts      # 50% unit + 50% margin
│   │   ├── seasonality.calculator.ts # índice 12 meses (ajuste opcional del sugerido)
│   │   ├── abcd.classifier.ts        # reglas duras + score 5 dim
│   │   ├── suggestion.calculator.ts  # cantidad ideal + decisión + motivo
│   │   ├── score.calculator.ts       # 5 dimensiones ponderadas
│   │   ├── comparator.scorer.ts      # 5 dimensiones droguería
│   │   └── engine-params.ts          # parámetros centralizados (días cobertura, umbrales)
│   └── dto/
└── ...
```

> **Recorte:** No hay `jobs/recalculate-classifications.cron.ts` (no hay
> cron), no hay `events/` (no hay suscriptores), no hay `dynamization.*` ni
> `decoding.*` (esos flujos se eliminaron — se reemplazan con badges en el
> portafolio + acción manual del comprador).

### Engine — pureza obligatoria

El módulo `engine/` contiene **funciones puras**:
- No importan `Repository<>` de TypeORM.
- No tienen efectos secundarios.
- Reciben datos como input, devuelven datos como output.
- 100% testeable con Jest sin BD.

Los services consumen el engine: cargan datos de BD, llaman engine, persisten
resultado. Esto cumple el PRD §8.5 (mantenibilidad: motor aislado para
reemplazo futuro por implementaciones más sofisticadas).

## 6. Endpoints clave (REST)

### Configuración

```
POST   /v1/purchases-intelligence/conditions/drugstore
PUT    /v1/purchases-intelligence/conditions/drugstore/:id
DELETE /v1/purchases-intelligence/conditions/drugstore/:id
POST   /v1/purchases-intelligence/conditions/lab
PUT    /v1/purchases-intelligence/conditions/lab/:id
```

### Motor

```
POST   /v1/purchases-intelligence/recalculate?branch_id=          # on-demand desde dashboard
GET    /v1/purchases-intelligence/classifications?branch_id=&abcd=  # portafolio ABCD (con filtros)
```

### Sugerido (on-demand, no se persiste el snapshot)

```
POST   /v1/purchases-intelligence/suggestions/generate
       Body: { branch_id, budget_usd, filters: {...} }
       Devuelve: lista de sugerencias in-memory + total estimado

POST   /v1/purchases-intelligence/suggestions/create-orders
       Body: { suggestions: [{...}], adjustments: {...} }
       Body trae la lista completa (frontend la devuelve tal cual la editó).
       Genera POs agrupadas por droguería en una sola transacción.
```

### Comparador

```
GET    /v1/purchases-intelligence/comparator/:productId?quantity=&branch_id=
```

### Dashboard

```
GET    /v1/purchases-intelligence/dashboard?branch_id=
       Devuelve KPIs: distribución ABCD, conteo Pareto, capital
       inmovilizado en C/D, productos vencimiento próximo, conteo de C
       (candidatos dinamizar) y D (candidatos descodificar).
```

> **Recorte:** No hay endpoints `/dynamization/*` ni `/decoding/*` ni
> `/classifications/:id/history`. Los productos C/D se filtran desde
> `/classifications?abcd=C` o `?abcd=D`; descodificar = `PATCH /v1/products/:id`
> con `{isActive: false}` (endpoint ya existente).

## 7. RBAC

Reutilizamos los roles del sistema existente. NO creamos rol "comprador" —
el `gerente_inventario` actual cumple ese papel y ya tiene los permisos
de compras del seed de Fase 2.

| Endpoint | Permission | Roles autorizados (del seed actual) |
|---|---|---|
| `GET /classifications`, `GET /dashboard`, `GET /comparator` | `purchases.view` | `administrador`, `gerente_inventario` |
| `POST /recalculate`, `POST /suggestions/generate` | `purchases.create` | `administrador`, `gerente_inventario` |
| `POST /conditions/*` | `purchases.create` | `administrador`, `gerente_inventario` |
| `POST /suggestions/create-orders` | `purchases.create` | `administrador`, `gerente_inventario` |
| Inactivar producto C/D (`PATCH /v1/products/:id`) | `catalog.create` (existente) | `administrador`, `gerente_inventario` |

> **Recorte:** El permission `purchases.approve_decoding` se elimina del
> plan. Descodificar = `isActive=false` en el producto, controlado por el
> permission `catalog.create` ya existente. Si el cliente pide diferenciar
> después, se agrega el permission entonces; ahora es ruido.

## 8. UI admin (React + MUI) — 4 pages nuevas

Estructura en `sigaf-frontend/src/features/purchases/`:

```
purchases/                            # mantiene rutas existentes para OC y recepciones
├── ui/
│   ├── pages/
│   │   ├── orders-list-page.tsx                  # YA EXISTE
│   │   ├── order-create-page.tsx                 # YA EXISTE
│   │   ├── order-detail-page.tsx                 # YA EXISTE
│   │   ├── order-edit-page.tsx                   # YA EXISTE
│   │   ├── receipts-list-page.tsx                # YA EXISTE
│   │   ├── receipt-create-page.tsx               # YA EXISTE
│   │   ├── receipt-detail-page.tsx               # YA EXISTE
│   │   ├── purchases-dashboard-page.tsx          # NUEVA — KPIs + botón "Recalcular"
│   │   ├── suggestions-page.tsx                  # NUEVA — sugerido operativo central
│   │   ├── portfolio-abcd-page.tsx               # NUEVA — tabla con filtros A/B/C/D + badges C/D
│   │   └── conditions-page.tsx                   # NUEVA — config drogería + lab
│   ├── views/                       # composición de cada page
│   └── components/                  # composables compartidos
│       ├── comparator-modal.tsx     # comparador droguerías embebido en sugerido
│       ├── abcd-badge.tsx
│       ├── pareto-badge.tsx
│       ├── decision-badge.tsx
│       └── score-bar.tsx
```

> **Recorte:** No hay `dynamization-page.tsx`, `decoding-page.tsx` ni
> `price-list-import-page.tsx`. Los flujos C/D se cubren con filtros del
> `portfolio-abcd-page` (badge "candidato dinamizar" / "candidato
> descodificar"). Import de listas usa el módulo `imports` existente sin
> pantalla nueva.

### Sidebar nav update

El nav admin actualmente lista "Compras → Órdenes / Recepciones / Reclamos".
Se reorganiza:

```
Compras
├── Dashboard
├── Sugerido de compra        ⭐ acción principal del comprador
├── Portafolio ABCD           (filtros C/D para gestionar dinamización/descod.)
├── Órdenes de compra         (existente)
├── Recepciones               (existente)
├── Reclamos                  (existente)
└── Condiciones comerciales   (subadmin)
```

## 9. Plan día por día — 6-7 días (recortado 2026-05-28)

| Día | Tarea | Salida verificable |
|---|---|---|
| 1 | Backend: migración (3 tablas nuevas + ALTER supplier_products + ALTER purchase_order_items) + entities + DTOs base. `conditions.service` + controller + tests unit. | Tablas creadas; `POST /conditions/drugstore` + `POST /conditions/lab` funcionan. |
| 2 | Backend engine puro: `net-cost.calculator` (3 escenarios) + `rotation.calculator` + `pareto.calculator` + tests Jest sin BD. `comparator.service` + controller. | `GET /comparator/:productId` devuelve droguerías ordenadas con puntaje. Engine pasa tests unit. |
| 3 | Backend engine puro: `abcd.classifier` (5 dim) + `score.calculator` + `suggestion.calculator` + `seasonality.calculator` (ajuste opcional) + tests. `classifications.service` (persiste snapshot vigente) + `suggestions.service` (in-memory, no persiste). Endpoints `POST /recalculate`, `POST /suggestions/generate`, `GET /classifications`. | `POST /recalculate` persiste `product_classifications`. `POST /suggestions/generate` devuelve lista con decisión+motivo+score. |
| 4 | Frontend: `conditions-page` + `comparator-modal` + `suggestions-page` con botón "Recalcular". Integración react-query. | Comprador puede crear condiciones, generar sugerido, ver comparador embebido. |
| 5 | Frontend: integración sugerido → `POST /suggestions/create-orders` (backend agrupa por droguería en una transacción). `portfolio-abcd-page` con filtros A/B/C/D + badges. `purchases-dashboard-page` con KPIs básicos. | Comprador genera sugerido → selecciona → "Crear OC" → POs creadas agrupadas. Portafolio muestra C/D con badges. Dashboard muestra KPIs. |
| 6 | Tests E2E del flujo completo + verificación de no-regresión POS (script §10) + docs. | Lint+typecheck verdes en backend y frontend. POS sin regresiones. Engine con cobertura >80%. |
| 7 (buffer) | Ajustes de UX por feedback del cliente + edge cases del engine (data flaky, productos sin histórico, etc.). | Sprint cerrado. Listo para HKA. |

**Total: 6-7 días** (vs 12 originales). El recorte sacrifica: cron diario,
workflows formales C/D, audit-log de categoría, snapshot de cada corrida
del sugerido. Si el cliente los pide tras go-live, se reagregan con outbox
+ audit_log general en Sprint D post-instalación.

## 10. Verificación de no-regresión del POS

Tras Días 1 y 12 (y al finalizar cada fase), correr:

```bash
# 1. Typecheck del POS
cd pos-tauri && npm run lint && npx tsc --noEmit

# 2. Verificar que el bootstrap del POS sigue funcionando con
#    el catálogo refactorizado (los productos siguen exponiendo
#    los campos que el POS lee).
curl -X POST "$BACKEND/v1/auth/email/login" -d ...
curl "$BACKEND/v1/products?branchId=X&isActive=true&limit=1" | jq '.data[0].id, .pmvp, .taxType, .totalStock'

# 3. Verificar que crear ticket sigue funcionando
curl -X POST "$BACKEND/v1/sales/tickets" -H "Idempotency-Key: ..." ...
```

Si todo eso devuelve OK, el POS no se rompió.

## 11. Reglas y trampas a evitar

### Reglas inviolables

| # | Regla | Por qué |
|---|---|---|
| RP-1 | **NO** modificar columnas existentes de `products`, `prices`, `inventory_lots`, `sale_tickets` ni sus entities. | El POS las lee. Cualquier renombramiento rompe el POS sin warning. |
| RP-2 | **NO** modificar el shape de respuesta de `GET /v1/products`. El POS lo cachea localmente. | Romper el shape rompe el bootstrap del POS. |
| RP-3 | El motor (engine/) es **funciones puras** sin Repositories ni efectos secundarios. | El PRD §8.5 lo exige. Permite testear sin BD. |
| RP-4 | Parámetros del motor (días cobertura, umbrales, pesos del score 5 dim) centralizados en `engine-params.ts`. | El PRD §8.5 lo exige. Permite ajustar sin redeploy. |
| RP-5 | El sugerido NO impone; el comprador puede ajustar cantidades en la OC. Solo bloquea vencimiento <90d (regla dura del PRD §9.3). | Adopción: si el sistema rigidiza, el comprador lo abandona. |
| RP-6 | El pronto pago **NO** se asume por defecto en el cálculo de margen. Solo aparece como escenario adicional. | PRD §7.2 / §16.2: decisión de diseño explícita para no proyectar márgenes irreales. |
| RP-7 | El nombre de la columna `is_drugstore` en `suppliers` no se renombra. Sigue siendo el flag binario. | Compatibilidad con módulo `suppliers` existente. |
| RP-8 | Productos C **promovidos a B forzosamente** (cuando son Pareto) requieren revisión gerencial — marcar `forced_promotion_to_b = TRUE` en `product_classifications`. | PRD §9.2.3 excepción explícita. |
| RP-9 | Una sola empresa. NO agregar `company_id` / `tenant_id` / `empresa_id` en ninguna tabla. `branch_id` aparece SOLO cuando los datos son específicos de una sucursal (stock, sugerido, classifications). Tablas de configuración global del negocio (condiciones droguería/laboratorio) NO llevan `branch_id`. | El sistema es para un solo cliente, no SaaS multi-empresa. Las "sucursales" son del mismo dueño y comparten catálogo, proveedores, condiciones comerciales. |
| RP-10 | Naming en código en inglés (`DynamizationAlert`, `DecodingRequest`, `AbcdClassifier`). UI en español (Dinamización, Descodificación, Portafolio ABCD). | Convención del proyecto. El PRD viene en español; mapeo claro a inglés técnico. |

### Anti-patterns

```typescript
// ❌ MAL — engine importa Repository
@Injectable()
export class AbcdClassifier {
  constructor(@InjectRepository(Product) private repo: Repository<Product>) {}
}

// ✅ BIEN — engine recibe data
export function classifyProduct(input: {
  sales: SaleInput[];
  stock: number;
  margin: number;
  // ...
  params: EngineParams;
}): { abcd: 'A'|'B'|'C'|'D'; score: number; reason: string } {
  // pure logic
}
```

```typescript
// ❌ MAL — asumir pronto pago como costo base
const netCost = price * (1 - cab) * (1 - lineal) * (1 - escala) * (1 - vol) * (1 - prontoPago);

// ✅ BIEN — 3 escenarios separados
const conservative = price * (1 - cab) * (1 - lineal);
const commercial   = conservative * (1 - escala) * (1 - vol);
const financial    = commercial * (1 - prontoPago);  // solo informativo

const marginProjection = (salePrice - conservative) / salePrice; // ← contra conservador
```

```typescript
// ❌ MAL — UI hardcodea categorías
const filters = [{ label: 'A', value: 'A' }, { label: 'B', value: 'B' }, ...];

// ✅ BIEN — UI lee categorías del backend (extensible)
const { data: categories } = useAbcdCategories();
```

---

**Última revisión**: 2026-05-28 (recorte aplicado: 4 tablas eliminadas, 3
pantallas eliminadas, cron eliminado, score 5 dim, 6-7 días vs 12). Si
tocas tablas o flujos del módulo, vuelve a leer §11 (reglas inviolables).
