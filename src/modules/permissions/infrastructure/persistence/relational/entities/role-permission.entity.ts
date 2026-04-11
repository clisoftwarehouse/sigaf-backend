import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';

import { PermissionEntity } from './permission.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('role_permissions')
export class RolePermissionEntity extends EntityRelationalHelper {
  @PrimaryColumn('uuid', { name: 'role_id' })
  roleId: string;

  @PrimaryColumn('uuid', { name: 'permission_id' })
  permissionId: string;

  @ManyToOne(() => PermissionEntity)
  @JoinColumn({ name: 'permission_id' })
  permission: PermissionEntity;
}
