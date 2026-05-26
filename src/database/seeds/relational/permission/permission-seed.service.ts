import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/role-permission.entity';

const PERMISSIONS = [
  // Auth
  { code: 'auth.login', description: 'Iniciar sesión', module: 'auth' },
  // Products
  { code: 'products.view', description: 'Ver productos', module: 'products' },
  { code: 'products.create', description: 'Crear productos', module: 'products' },
  { code: 'products.edit', description: 'Editar productos', module: 'products' },
  { code: 'products.delete', description: 'Eliminar productos', module: 'products' },
  // Inventory
  { code: 'inventory.view', description: 'Ver inventario', module: 'inventory' },
  { code: 'inventory.adjust', description: 'Ajustar inventario', module: 'inventory' },
  { code: 'inventory.transfer', description: 'Transferir inventario', module: 'inventory' },
  { code: 'inventory.count', description: 'Conteo de inventario', module: 'inventory' },
  // Purchases
  { code: 'purchases.view', description: 'Ver compras', module: 'purchases' },
  { code: 'purchases.create', description: 'Crear órdenes de compra', module: 'purchases' },
  { code: 'purchases.receive', description: 'Recibir mercancía', module: 'purchases' },
  // Suppliers
  { code: 'suppliers.view', description: 'Ver proveedores', module: 'suppliers' },
  { code: 'suppliers.manage', description: 'Gestionar proveedores', module: 'suppliers' },
  // POS
  { code: 'pos.sell', description: 'Realizar ventas', module: 'pos' },
  { code: 'pos.void', description: 'Anular ventas', module: 'pos' },
  { code: 'pos.return', description: 'Devoluciones', module: 'pos' },
  { code: 'pos.cash_session', description: 'Gestionar sesión de caja', module: 'pos' },
  { code: 'pos.discount.override', description: 'Override de descuento manual', module: 'pos' },
  // Customers (B2C)
  { code: 'customers.view', description: 'Ver clientes', module: 'customers' },
  { code: 'customers.manage', description: 'Crear/editar clientes', module: 'customers' },
  // Prescriptions
  { code: 'prescriptions.view', description: 'Ver récipes', module: 'prescriptions' },
  { code: 'prescriptions.manage', description: 'Registrar/editar récipes', module: 'prescriptions' },
  // Cash Sessions
  { code: 'cash.open', description: 'Abrir sesión de caja', module: 'cash' },
  { code: 'cash.close', description: 'Cerrar sesión de caja', module: 'cash' },
  { code: 'cash.adjust', description: 'Movimientos manuales (payout/deposit/adjustment)', module: 'cash' },
  { code: 'cash.view', description: 'Ver sesiones y reportes X/Z', module: 'cash' },
  // Terminals (admin)
  { code: 'terminals.pair', description: 'Generar códigos de emparejamiento', module: 'terminals' },
  { code: 'terminals.revoke_key', description: 'Revocar apiKey de un terminal', module: 'terminals' },
  // Audit
  { code: 'audit.view', description: 'Ver auditoría', module: 'audit' },
  // Admin
  { code: 'admin.users', description: 'Gestionar usuarios', module: 'admin' },
  { code: 'admin.roles', description: 'Gestionar roles', module: 'admin' },
  { code: 'admin.config', description: 'Configuración global', module: 'admin' },
];

// Mapping rol → permisos. Fuente de verdad para la asignación inicial.
// Cuando agregues permisos nuevos o cambien las reglas operativas, edita
// PERMISSIONS arriba y este mapping; el seed es idempotente y reconcilia.
//
// Diseño:
//   - `administrador` siempre tiene TODO (espejo del array completo).
//   - `farmaceutico_regente`: catálogo (view), inventario y récipes.
//     Puede registrar récipes médicos y consultar dispensaciones.
//   - `cajero`: opera el POS — vende, devuelve, abre/cierra caja, busca clientes.
//     NO puede anular tickets (eso requiere supervisor con `pos.void`).
//   - `gerente_inventario`: catálogo full, inventario, compras, proveedores,
//     traslados. NO toca usuarios ni configuración global.
const ROLE_PERMISSIONS: Record<string, string[]> = {
  administrador: PERMISSIONS.map((p) => p.code),
  farmaceutico_regente: [
    'auth.login',
    'products.view',
    'inventory.view',
    'prescriptions.view',
    'prescriptions.manage',
    'customers.view',
    'audit.view',
  ],
  cajero: [
    'auth.login',
    'products.view',
    'inventory.view',
    'pos.sell',
    'pos.return',
    'pos.cash_session',
    'cash.open',
    'cash.close',
    'cash.view',
    'customers.view',
    'customers.manage',
    'prescriptions.view',
  ],
  gerente_inventario: [
    'auth.login',
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'inventory.view',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.count',
    'purchases.view',
    'purchases.create',
    'purchases.receive',
    'suppliers.view',
    'suppliers.manage',
    'cash.view',
    'cash.adjust',
    'audit.view',
    // Operaciones de supervisión en caja: el gerente es quien físicamente
    // autoriza anulaciones y devoluciones cuando un cajero las requiere.
    // Sin estos permisos, no podría usar su PIN para autorizar en el POS.
    'pos.void',
    'pos.return',
    'pos.discount.override',
  ],
};

@Injectable()
export class PermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private roleRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private rolePermissionRepository: Repository<RolePermissionEntity>,
  ) {}

  async run() {
    // 1) Upsert de permisos. Si agregaste códigos nuevos al PERMISSIONS array,
    // se crean acá; los existentes mantienen su descripción salvo que cambie.
    for (const perm of PERMISSIONS) {
      const existing = await this.permissionRepository.findOne({ where: { code: perm.code } });
      if (!existing) {
        await this.permissionRepository.save(this.permissionRepository.create(perm));
        console.log(`Permission '${perm.code}' created`);
        continue;
      }
      if (existing.description !== perm.description || existing.module !== perm.module) {
        existing.description = perm.description;
        existing.module = perm.module;
        await this.permissionRepository.save(existing);
        console.log(`Permission '${perm.code}' updated`);
      }
    }

    // 2) Sincronizar role_permissions. La estrategia es reconciliar (no purgar):
    // borramos las asignaciones del rol que ya no estén en el mapping y agregamos
    // las nuevas. Esto permite que el admin agregue permisos extra a un rol
    // desde la UI sin que el seed se los quite, MIENTRAS QUE el seed asegura
    // un piso mínimo (los del mapping). Para esto:
    //   - Iteramos cada rol del mapping.
    //   - Calculamos qué permisos faltan y los insertamos.
    //   - NO borramos los que el admin agregó manualmente.
    for (const [roleName, codes] of Object.entries(ROLE_PERMISSIONS)) {
      const role = await this.roleRepository.findOne({ where: { name: roleName } });
      if (!role) {
        console.warn(`Role '${roleName}' not found — saltando asignación de permisos`);
        continue;
      }
      // Guard defensivo: TypeORM `IN ()` con array vacío fallaría con sintaxis
      // SQL inválida. El mapping nunca tiene listas vacías, pero el guard
      // protege contra cambios futuros que las introduzcan.
      if (codes.length === 0) continue;
      const permissionEntities = await this.permissionRepository
        .createQueryBuilder('p')
        .where('p.code IN (:...codes)', { codes })
        .getMany();
      if (permissionEntities.length === 0) continue;

      const existingLinks = await this.rolePermissionRepository.find({
        where: { roleId: role.id },
      });
      const existingPermIds = new Set(existingLinks.map((l) => l.permissionId));

      const toAdd = permissionEntities.filter((p) => !existingPermIds.has(p.id));
      if (toAdd.length === 0) continue;
      for (const perm of toAdd) {
        await this.rolePermissionRepository.save(
          this.rolePermissionRepository.create({
            roleId: role.id,
            permissionId: perm.id,
          }),
        );
      }
      console.log(`Role '${roleName}' +${toAdd.length} permission(s)`);
    }
  }
}
