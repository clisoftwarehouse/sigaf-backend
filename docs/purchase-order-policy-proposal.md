# Propuesta de Política de Órdenes de Compra (OC)

**Para revisión de:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Revisada por:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
**Fecha:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## Contexto

Hoy el sistema permite que cualquier usuario con permiso de compras apruebe una orden de compra sin validaciones de monto, categoría o presupuesto. Cuando una OC está en estado `borrador` (`draft`), basta con un clic para pasarla a `enviada` (`sent`) y habilitar recepciones contra ella.

Queremos definir reglas claras para:
1. Controlar riesgo financiero (que nadie apruebe compras grandes sin la revisión adecuada).
2. Cumplir con regulaciones de productos controlados.
3. Evitar errores comunes en la recepción (cantidades o precios que no cuadran con lo ordenado).
4. Mantener limpio el sistema (OCs abandonadas no deben quedar abiertas eternamente).

Este documento propone las reglas. **Marca en cada sección si aceptas el default, modifícalo, o indica que no aplica.**

---

## 1. Aprobación por monto (escala de autoridad)

**Regla:** según el total de la OC (en USD), distintos roles pueden aprobarla.

### Default propuesto

| Monto total (USD)    | Quién puede aprobar                       |
| -------------------- | ----------------------------------------- |
| ≤ 500                | Comprador / encargado de sucursal         |
| 501 – 5.000          | Supervisor                                |
| > 5.000              | Gerencia                                  |

### Revisión del experto

| Monto propuesto      | Monto ajustado | Rol aprobador (nombre del cargo) |
| -------------------- | -------------- | -------------------------------- |
| ≤ 500                |                |                                  |
| 501 – 5.000          |                |                                  |
| > 5.000              |                |                                  |

**Notas adicionales:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 2. Aprobación por tipo de producto

**Regla:** algunas categorías pueden requerir aprobación especial independiente del monto.

### Candidatos comunes en farmacia

- [ ] **Psicotrópicos / estupefacientes** → requieren firma del farmacéutico regente
- [ ] **Antibióticos** → requieren firma del farmacéutico regente
- [ ] **Productos de cadena de frío (vacunas, biológicos)** → requieren validación de logística antes de aprobar
- [ ] **Productos importados (mayoristas extranjeros)** → requieren gerencia independiente del monto
- [ ] **Otro:** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

**Nota:** marca con ✓ las que aplican y escribe el cargo que debe aprobarlas al lado.

---

## 3. Consignaciones vs compras regulares

**Regla:** las órdenes de tipo `consignment` (consignación) tienen un flujo distinto a las compras.

| Aspecto                         | Compras regulares | Consignaciones |
| ------------------------------- | ----------------- | -------------- |
| Umbrales de monto               | ✓ aplica          | ☐ aplica ☐ no  |
| Requiere aprobación especial    | No                | ☐ sí ☐ no      |

**¿Quién aprueba una consignación?** \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 4. Validaciones sobre proveedores

Hoy el frontend filtra proveedores inactivos pero el backend no tiene esa regla como restricción "dura".

### Default propuesto

- [x] **Bloquear OCs a proveedores con `isActive = false`** (regla dura; no se pueden enviar órdenes a proveedores inactivos).
- [ ] **Bloquear OCs si el proveedor no tiene RIF registrado.**
- [ ] **Bloquear OCs si el proveedor no tiene contrato vigente firmado.**

### Revisión del experto

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

---

## 5. Tolerancias al recibir mercancía

Hoy se puede recibir cualquier cantidad contra una OC. Queremos poner un guardrail.

### Default propuesto

- **Cantidad recibida**: permitir hasta **+5%** sobre lo ordenado sin alerta; más allá, se pide justificación escrita.
- **Costo unitario**: si el costo unitario recibido difiere en más de **±10%** del costo de la OC, mostrar alerta y requerir confirmación del supervisor.

### Revisión del experto

| Regla                               | Default | Ajuste |
| ----------------------------------- | ------- | ------ |
| Tolerancia de cantidad (+ %)        | 5%      |        |
| Desviación máxima de costo unitario | 10%     |        |

**¿Preferirías bloquear en lugar de solo alertar?**

- [ ] Solo alertar (default)
- [ ] Bloquear y requerir re-aprobación

---

## 6. Expiración automática de borradores

**Regla:** si una OC queda en `draft` por mucho tiempo, probablemente fue abandonada o ya no es relevante.

### Default propuesto

OCs en `draft` por más de **30 días** pasan automáticamente a `cancelled`. El usuario puede crear una nueva si aún aplica.

### Revisión del experto

- [ ] Aceptar 30 días
- [ ] Cambiar a: \_\_\_\_\_ días
- [ ] No auto-cancelar; dejar manual

---

## 7. Presupuesto por sucursal (opcional — más complejo)

**Regla:** cada sucursal tiene un presupuesto mensual de compras. Al aprobar una OC, se descuenta del presupuesto disponible.

Esta regla requiere un módulo nuevo ("Presupuestos"). **No la implementamos en esta fase, pero lo dejamos listado para planificación futura.**

### ¿Es prioritario?

- [ ] Sí, incluir en la siguiente fase
- [ ] Sí, pero más adelante
- [ ] No, no es necesario

---

## Resumen para implementación

Después de esta revisión, nuestro equipo técnico implementará solo las reglas aceptadas. Las que queden como "ajustar" o "no aplica" las excluimos.

**Prioridad sugerida si hay que elegir pocas:**

1. Aprobación por monto (sección 1) — más crítica, mitiga el mayor riesgo financiero.
2. Validación de proveedor inactivo (sección 4) — barata de implementar, evita errores comunes.
3. Expiración de borradores (sección 6) — higiene del sistema.

---

## Firmas

**Revisado y aprobado por:**

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Nombre, cargo

\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
Fecha
