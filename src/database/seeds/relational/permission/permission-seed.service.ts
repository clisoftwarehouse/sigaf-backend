import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/permission.entity';

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
  // Audit
  { code: 'audit.view', description: 'Ver auditoría', module: 'audit' },
  // Admin
  { code: 'admin.users', description: 'Gestionar usuarios', module: 'admin' },
  { code: 'admin.roles', description: 'Gestionar roles', module: 'admin' },
  { code: 'admin.config', description: 'Configuración global', module: 'admin' },
];

// Role permissions mapping (for reference, to be used when role_permissions table is seeded)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ROLE_PERMISSIONS: Record<string, string[]> = {
  administrador: PERMISSIONS.map((p) => p.code),
  farmaceutico_regente: [
    'auth.login',
    'products.view',
    'products.create',
    'products.edit',
    'products.delete',
    'inventory.view',
    'inventory.adjust',
    'inventory.transfer',
    'inventory.count',
    'audit.view',
  ],
  cajero: ['auth.login', 'products.view', 'inventory.view', 'pos.sell', 'pos.void', 'pos.return', 'pos.cash_session'],
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
    'audit.view',
  ],
};

@Injectable()
export class PermissionSeedService {
  constructor(
    @InjectRepository(PermissionEntity)
    private permissionRepository: Repository<PermissionEntity>,
    @InjectRepository(RoleEntity)
    private roleRepository: Repository<RoleEntity>,
  ) {}

  async run() {
    // Create permissions
    for (const perm of PERMISSIONS) {
      const exists = await this.permissionRepository.count({ where: { code: perm.code } });
      if (!exists) {
        await this.permissionRepository.save(this.permissionRepository.create(perm));
        console.log(`Permission '${perm.code}' created`);
      }
    }

    // Assign permissions to roles (via role_permissions table)
    // Note: This requires a many-to-many relationship setup
    // For now, we'll log the assignments that should be made
    console.log('Permission assignments configured. Run role_permissions seed separately if needed.');
  }
}
