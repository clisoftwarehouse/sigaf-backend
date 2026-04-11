import { Session } from '../../../../domain/session';
import { SessionEntity } from '../entities/session.entity';
import { UserMapper } from '@/modules/users/infrastructure/persistence/relational/mappers/user.mapper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

export class SessionMapper {
  static toDomain(raw: SessionEntity): Session {
    const domainEntity = new Session();
    domainEntity.id = raw.id;
    domainEntity.userId = raw.userId;
    if (raw.user) {
      domainEntity.user = UserMapper.toDomain(raw.user);
    }
    domainEntity.hash = raw.hash;
    domainEntity.ipAddress = raw.ipAddress;
    domainEntity.terminalId = raw.terminalId;
    domainEntity.expiresAt = raw.expiresAt;
    domainEntity.createdAt = raw.createdAt;
    return domainEntity;
  }

  static toPersistence(domainEntity: Session): SessionEntity {
    const user = new UserEntity();
    user.id = domainEntity.user.id;

    const persistenceEntity = new SessionEntity();
    if (domainEntity.id) {
      persistenceEntity.id = domainEntity.id;
    }
    persistenceEntity.userId = domainEntity.user.id;
    persistenceEntity.hash = domainEntity.hash;
    persistenceEntity.user = user;
    persistenceEntity.ipAddress = domainEntity.ipAddress;
    persistenceEntity.terminalId = domainEntity.terminalId;
    persistenceEntity.expiresAt = domainEntity.expiresAt;
    persistenceEntity.createdAt = domainEntity.createdAt;

    return persistenceEntity;
  }
}
