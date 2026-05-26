import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionEntity } from './infrastructure/persistence/relational/entities/role-permission.entity';

// TTL del cache de permisos por rol. 5 minutos: si admin modifica permisos de
// un rol, los efectos se ven en máximo 5 min sin necesidad de re-login del
// usuario. Trade-off entre frescura y carga sobre la DB en cada request.
const ROLE_PERMS_CACHE_TTL_MS = 5 * 60_000;

type RolePermsEntry = { codes: Set<string>; expiresAt: number };

@Injectable()
export class PermissionsService {
  private readonly rolePermsCache = new Map<string, RolePermsEntry>();

  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repo: Repository<PermissionEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermsRepo: Repository<RolePermissionEntity>,
  ) {}

  async findAll(): Promise<PermissionEntity[]> {
    return this.repo.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async findByModule(module: string): Promise<PermissionEntity[]> {
    return this.repo.find({ where: { module }, order: { code: 'ASC' } });
  }

  /**
   * Devuelve los `permission.code`s asociados al rol. Resultados cacheados
   * en memoria con TTL de 5 min — primera request hit BD, siguientes hit cache.
   * Cambios en role_permissions vía admin se reflejan al expirar la entrada.
   *
   * Si el rol no tiene asignaciones (o no existe), devuelve un Set vacío.
   */
  async getPermissionCodesByRoleId(roleId: string): Promise<Set<string>> {
    const cached = this.rolePermsCache.get(roleId);
    const now = Date.now();
    if (cached && cached.expiresAt > now) return cached.codes;

    const rows = await this.rolePermsRepo
      .createQueryBuilder('rp')
      .innerJoin('rp.permission', 'p')
      .select('p.code', 'code')
      .where('rp.role_id = :roleId', { roleId })
      .getRawMany<{ code: string }>();

    const codes = new Set(rows.map((r) => r.code));
    this.rolePermsCache.set(roleId, { codes, expiresAt: now + ROLE_PERMS_CACHE_TTL_MS });
    return codes;
  }

  /**
   * Invalida el cache de un rol. Llamar desde RolesService cuando se modifican
   * los permisos del rol — así los cambios se aplican inmediatamente sin esperar
   * el TTL.
   */
  invalidateRoleCache(roleId: string): void {
    this.rolePermsCache.delete(roleId);
  }

  /** Invalida toda la cache. Útil tras un seed o migración masiva. */
  invalidateAllCache(): void {
    this.rolePermsCache.clear();
  }
}
