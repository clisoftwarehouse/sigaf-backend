import { InjectRepository } from '@nestjs/typeorm';
import { In, DataSource, Repository } from 'typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { CreateRoleDto, UpdateRoleDto } from './dto';
import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';
import { PermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/role-permission.entity';

export type RoleWithPermissions = RoleEntity & { permissions: PermissionEntity[] };

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
    @InjectRepository(RolePermissionEntity)
    private readonly rolePermissionRepository: Repository<RolePermissionEntity>,
    @InjectRepository(PermissionEntity)
    private readonly permissionRepository: Repository<PermissionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(): Promise<RoleWithPermissions[]> {
    const roles = await this.roleRepository.find({ order: { name: 'ASC' } });
    return Promise.all(roles.map((role) => this.attachPermissions(role)));
  }

  async findOne(id: string): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');
    return this.attachPermissions(role);
  }

  async findByName(name: string): Promise<RoleEntity | null> {
    return this.roleRepository.findOne({ where: { name } });
  }

  async create(dto: CreateRoleDto): Promise<RoleWithPermissions> {
    const existing = await this.findByName(dto.name);
    if (existing) throw new ConflictException(`Rol '${dto.name}' ya existe`);

    if (dto.permissionIds?.length) {
      await this.assertPermissionsExist(dto.permissionIds);
    }

    return this.dataSource.transaction(async (manager) => {
      const role = manager.create(RoleEntity, {
        name: dto.name,
        description: dto.description ?? null,
      });
      const saved = await manager.save(role);

      if (dto.permissionIds?.length) {
        const links = dto.permissionIds.map((permissionId) =>
          manager.create(RolePermissionEntity, { roleId: saved.id, permissionId }),
        );
        await manager.save(links);
      }

      return this.attachPermissions(saved);
    });
  }

  async update(id: string, dto: UpdateRoleDto): Promise<RoleWithPermissions> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) throw new NotFoundException('Rol no encontrado');

    if (dto.name && dto.name !== role.name) {
      const dup = await this.findByName(dto.name);
      if (dup) throw new ConflictException(`Rol '${dto.name}' ya existe`);
    }

    if (dto.permissionIds?.length) {
      await this.assertPermissionsExist(dto.permissionIds);
    }

    return this.dataSource.transaction(async (manager) => {
      if (dto.name !== undefined) role.name = dto.name;
      if (dto.description !== undefined) role.description = dto.description;
      await manager.save(role);

      if (dto.permissionIds !== undefined) {
        await manager.delete(RolePermissionEntity, { roleId: id });
        if (dto.permissionIds.length > 0) {
          const links = dto.permissionIds.map((permissionId) =>
            manager.create(RolePermissionEntity, { roleId: id, permissionId }),
          );
          await manager.save(links);
        }
      }

      return this.attachPermissions(role);
    });
  }

  private async attachPermissions(role: RoleEntity): Promise<RoleWithPermissions> {
    const links = await this.rolePermissionRepository.find({
      where: { roleId: role.id },
      relations: ['permission'],
    });
    return Object.assign(role, { permissions: links.map((l) => l.permission) });
  }

  private async assertPermissionsExist(ids: string[]): Promise<void> {
    const found = await this.permissionRepository.find({ where: { id: In(ids) }, select: ['id'] });
    if (found.length !== ids.length) {
      const foundIds = new Set(found.map((p) => p.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      throw new NotFoundException(`Permisos no encontrados: ${missing.join(', ')}`);
    }
  }
}
