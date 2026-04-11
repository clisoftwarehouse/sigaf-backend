import { User } from '../../../../domain/user';
import { UserEntity } from '../entities/user.entity';
import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';

export class UserMapper {
  static toDomain(raw: UserEntity): User {
    const domainEntity = new User();
    domainEntity.id = raw.id;
    domainEntity.username = raw.username;
    domainEntity.password = raw.password;
    domainEntity.fullName = raw.fullName;
    domainEntity.cedula = raw.cedula;
    domainEntity.email = raw.email;
    domainEntity.phone = raw.phone;
    domainEntity.role = raw.role;
    domainEntity.isActive = raw.isActive;
    domainEntity.lastLoginAt = raw.lastLoginAt;
    domainEntity.createdAt = raw.createdAt;
    domainEntity.updatedAt = raw.updatedAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: User): UserEntity {
    const persistenceEntity = new UserEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.username = domainEntity.username;
    if (domainEntity.password) {
      persistenceEntity.password = domainEntity.password;
    }
    persistenceEntity.fullName = domainEntity.fullName;
    persistenceEntity.cedula = domainEntity.cedula;
    persistenceEntity.email = domainEntity.email;
    persistenceEntity.phone = domainEntity.phone;
    if (domainEntity.role) {
      const role = new RoleEntity();
      role.id = domainEntity.role.id;
      persistenceEntity.role = role;
      persistenceEntity.roleId = domainEntity.role.id;
    }
    persistenceEntity.isActive = domainEntity.isActive;
    persistenceEntity.lastLoginAt = domainEntity.lastLoginAt;
    persistenceEntity.createdAt = domainEntity.createdAt;
    persistenceEntity.updatedAt = domainEntity.updatedAt;
    return persistenceEntity;
  }
}
