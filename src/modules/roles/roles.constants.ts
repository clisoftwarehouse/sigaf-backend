import { RoleEnum } from './roles.enum';

/**
 * Combinaciones de roles típicas, para no repetir tuplas largas en cada
 * controller. Si en el futuro creamos nuevos roles (ej. cajero_senior,
 * supervisor), basta con extender estas constantes y todos los controllers
 * que las usan se actualizan automáticamente.
 *
 * Reglas operativas del negocio:
 *
 *   - `admin` toca todo (escapatoria).
 *   - `gerente_inventario` controla catálogo, precios, compras, inventario,
 *     promociones, organización (sucursales, terminales). Es el operador
 *     principal del back-office.
 *   - `farmaceutico_regente` puede crear récipes médicos y consultar
 *     dispensaciones, pero no toca catálogo ni inventario.
 *   - `cajero` opera el POS (ventas, cierre de caja, búsqueda de clientes)
 *     pero no escribe en módulos de back-office.
 */

export const CATALOG_WRITERS = [RoleEnum.admin, RoleEnum.gerente] as const;

export const INVENTORY_WRITERS = [RoleEnum.admin, RoleEnum.gerente] as const;

export const ORG_WRITERS = [RoleEnum.admin, RoleEnum.gerente] as const;

export const PRESCRIPTION_WRITERS = [RoleEnum.admin, RoleEnum.gerente, RoleEnum.farmaceutico] as const;

export const FINANCE_WRITERS = [RoleEnum.admin] as const;
