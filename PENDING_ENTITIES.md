# Entidades Pendientes de Implementación

Este documento lista las entidades de la base de datos que aún no tienen módulos completos (service, controller, DTOs).
Las entidades ya existen en TypeORM pero requieren implementación de lógica de negocio.

## Estado Actual

### ✅ Módulos 100% Implementados (Inventario Core)

| Módulo | Entidades | Service | Controller | DTOs | Swagger |
|--------|-----------|---------|------------|------|---------|
| Auth | User, Session | ✅ | ✅ | ✅ | ✅ |
| Categories | Category | ✅ | ✅ | ✅ | ✅ |
| Brands | Brand | ✅ | ✅ | ✅ | ✅ |
| Active Ingredients | ActiveIngredient | ✅ | ✅ | ✅ | ✅ |
| Suppliers | Supplier, SupplierProduct | ✅ | ✅ | ✅ | ✅ |
| Products | Product, ProductActiveIngredient, ProductSubstitute | ✅ | ✅ | ✅ | ✅ |
| Branches | Branch | ✅ | ✅ | ✅ | ✅ |
| Terminals | Terminal | ✅ | ✅ | ✅ | ✅ |
| Locations | WarehouseLocation | ✅ | ✅ | ✅ | ✅ |
| Inventory | InventoryLot, Kardex | ✅ | ✅ | ✅ | ✅ |
| Exchange Rates | ExchangeRate | ✅ | ✅ | ✅ | ✅ |
| Config Global | GlobalConfig | ✅ | ✅ | ✅ | ✅ |
| Permissions | Permission, RolePermission | ✅ | ✅ | - | ✅ |
| Audit | AuditLog | ✅ | - | - | - |

### 🔶 Entidades Creadas - Pendiente Módulo Completo

Estas entidades ya existen y están listas para usar, pero necesitan service/controller/DTOs:

#### Consignaciones (Crítico para farmacias)
- `ConsignmentEntryEntity` - Entradas de consignación
- `ConsignmentEntryItemEntity` - Items de entrada
- `ConsignmentLiquidationEntity` - Liquidaciones periódicas
- `ConsignmentLiquidationItemEntity` - Items de liquidación
- `ConsignmentReturnEntity` - Devoluciones al proveedor
- `ConsignmentReturnItemEntity` - Items de devolución

#### Compras
- `PurchaseOrderEntity` - Órdenes de compra
- `PurchaseOrderItemEntity` - Items de orden
- `GoodsReceiptEntity` - Recepción de mercancía
- `GoodsReceiptItemEntity` - Items de recepción

#### Inventario Avanzado
- `InventoryCountEntity` - Conteos de inventario
- `InventoryCountItemEntity` - Items de conteo
- `InventoryTransferEntity` - Transferencias entre sucursales
- `InventoryTransferItemEntity` - Items de transferencia

### ❌ Entidades NO Creadas (Implementar después)

#### POS (Point of Sale)
- `sale_tickets` - Tickets de venta
- `sale_ticket_items` - Items de ticket
- `sale_ticket_payments` - Pagos de ticket
- `cash_sessions` - Sesiones de caja
- `cash_movements` - Movimientos de caja

#### CRM (Pacientes/Clientes)
- `patients` - Pacientes
- `patient_prescriptions` - Récipes médicos
- `prescription_items` - Items de récipe
- `loyalty_transactions` - Transacciones de fidelidad

#### Colas/Turnos
- `queue_tickets` - Tickets de cola
- `queue_config` - Configuración de colas

#### Business Intelligence
- `bi_daily_sales` - Ventas diarias agregadas
- `bi_product_performance` - Performance de productos
- `product_abc_xyz` - Clasificación ABC/XYZ

#### Sistema
- `scheduled_tasks` - Tareas programadas
- `notifications` - Notificaciones

---

## Prioridad de Implementación

1. **Alta** - Consignaciones (requerido por ley para farmacias en Venezuela)
2. **Alta** - Compras y Recepción de mercancía
3. **Media** - Conteos y Transferencias de inventario
4. **Media** - POS (cuando se implemente el frontend de caja)
5. **Baja** - CRM, BI, Colas (funcionalidades adicionales)

---

## Notas Técnicas

- Todas las entidades usan UUID v4 como PK
- Montos monetarios: `NUMERIC(18,4)`
- Cantidades: `NUMERIC(12,3)`
- Timestamps: `TIMESTAMPTZ` en UTC
- Soft-delete con `is_active` donde aplique
- Kardex y audit_log son INSERT-ONLY (inmutables)
