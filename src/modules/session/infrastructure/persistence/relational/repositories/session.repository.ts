import { Not, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { User } from '@/modules/users/domain/user';
import { Session } from '../../../../domain/session';
import { SessionMapper } from '../mappers/session.mapper';
import { SessionEntity } from '../entities/session.entity';
import { SessionRepository } from '../../session.repository';
import { NullableType } from '@/common/utils/types/nullable.type';

@Injectable()
export class SessionRelationalRepository implements SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly sessionRepository: Repository<SessionEntity>,
  ) {}

  async findById(id: Session['id']): Promise<NullableType<Session>> {
    const entity = await this.sessionRepository.findOne({
      where: { id },
    });

    return entity ? SessionMapper.toDomain(entity) : null;
  }

  async create(data: Session): Promise<Session> {
    const persistenceModel = SessionMapper.toPersistence(data);
    const saved = await this.sessionRepository.save(this.sessionRepository.create(persistenceModel));
    return SessionMapper.toDomain(saved);
  }

  async update(id: Session['id'], payload: Partial<Omit<Session, 'id' | 'createdAt'>>): Promise<Session | null> {
    const entity = await this.sessionRepository.findOne({
      where: { id },
    });

    if (!entity) {
      throw new Error('Session not found');
    }

    const updatedEntity = await this.sessionRepository.save(
      this.sessionRepository.create(
        SessionMapper.toPersistence({
          ...SessionMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return SessionMapper.toDomain(updatedEntity);
  }

  async deleteById(id: Session['id']): Promise<void> {
    await this.sessionRepository.delete({ id });
  }

  async deleteByUserId(conditions: { userId: User['id'] }): Promise<void> {
    await this.sessionRepository.delete({ userId: conditions.userId });
  }

  async deleteByUserIdWithExclude(conditions: { userId: User['id']; excludeSessionId: Session['id'] }): Promise<void> {
    await this.sessionRepository.delete({
      userId: conditions.userId,
      id: Not(conditions.excludeSessionId),
    });
  }
}
