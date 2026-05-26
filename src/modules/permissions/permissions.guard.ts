import { Reflector } from '@nestjs/core';
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

import { PermissionsService } from './permissions.service';
import { PERMISSIONS_METADATA_KEY } from './permissions.decorator';

/**
 * Guard que verifica que el usuario autenticado tenga los `permission codes`
 * exigidos por el endpoint (vía `@RequirePermissions(...)`).
 *
 * Resolución:
 *   1. Lee la lista de permisos requeridos desde la metadata del handler/clase.
 *      Si está vacía → deja pasar (la endpoint no exige permisos).
 *   2. Obtiene `request.user.role.id` (puesto ahí por el JwtStrategy validator).
 *   3. Resuelve los permisos del rol vía `PermissionsService` (con cache).
 *   4. Exige que TODOS los permisos requeridos estén en el set del usuario.
 *
 * Si el JWT no incluye un role.id (caso terminal apiKey via JwtOrTerminalApiKeyGuard,
 * o cajero offline-loggeado sin role), rechaza con 403. El cajero offline
 * típicamente no llega acá porque sus endpoints (POS) se gating por permisos
 * abiertos (`pos.sell`, `cash.open`) que vienen en su role.
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const request = context.switchToHttp().getRequest<{
      user?: { role?: { id?: string; name?: string } };
    }>();
    const roleId = request.user?.role?.id;
    const roleName = request.user?.role?.name;
    if (!roleId) {
      throw new ForbiddenException('Usuario sin rol asignado; no puede acceder a este recurso.');
    }

    // Bypass de seguridad: `administrador` siempre pasa, sin importar lo que
    // diga la tabla `role_permissions`. Esto evita un lockout total si el seed
    // falla o queda incompleto (escenario de bootstrap inicial donde la BD
    // todavía no tiene las relaciones rol↔permiso, pero el admin necesita
    // acceso para arreglarlo). Espejo del `isAdmin` del frontend.
    if (roleName === 'administrador') return true;

    const userPerms = await this.permissionsService.getPermissionCodesByRoleId(roleId);
    const missing = required.filter((p) => !userPerms.has(p));
    if (missing.length > 0) {
      throw new ForbiddenException(`Faltan permisos para esta operación: ${missing.join(', ')}`);
    }
    return true;
  }
}
