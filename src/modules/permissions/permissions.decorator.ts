import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_METADATA_KEY = 'permissions';

/**
 * Marca un endpoint (o clase) con los permission codes requeridos.
 * Funciona en AND lógico: el usuario debe tener TODOS los permisos listados.
 *
 *   @RequirePermissions('products.create')
 *   @RequirePermissions('inventory.adjust', 'audit.view')   // necesita ambos
 *
 * Usar junto con `PermissionsGuard` en `@UseGuards(...)`. Si la lista está
 * vacía o el decorator no se aplica, el guard deja pasar (semántica idéntica
 * a RolesGuard).
 */
export const RequirePermissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
