import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, FindOptionsWhere } from 'typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { User } from '../../../../domain/user';
import { UserMapper } from '../mappers/user.mapper';
import { UserEntity } from '../entities/user.entity';
import { UserRepository } from '../../user.repository';
import { SortUserDto, FilterUserDto } from '../../../../dto';
import { NullableType } from '@/common/utils/types/nullable.type';
import { IPaginationOptions } from '@/common/utils/types/pagination-options';

@Injectable()
export class UsersRelationalRepository implements UserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>,
  ) {}

  async create(data: User): Promise<User> {
    const persistenceModel = UserMapper.toPersistence(data);
    const newEntity = await this.usersRepository.save(this.usersRepository.create(persistenceModel));
    return UserMapper.toDomain(newEntity);
  }

  async findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    const where: FindOptionsWhere<UserEntity> = {};
    if (filterOptions?.roles?.length) {
      where.roleId = filterOptions.roles[0].id as string;
    }
    if (filterOptions?.isActive !== undefined && filterOptions?.isActive !== null) {
      where.isActive = filterOptions.isActive;
    }

    const entities = await this.usersRepository.find({
      relations: ['role'],
      skip: (paginationOptions.page - 1) * paginationOptions.limit,
      take: paginationOptions.limit,
      where: where,
      order: sortOptions?.reduce(
        (accumulator, sort) => ({
          ...accumulator,
          [sort.orderBy]: sort.order,
        }),
        {},
      ),
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findById(id: User['id']): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByIds(ids: User['id'][]): Promise<User[]> {
    const entities = await this.usersRepository.find({
      where: { id: In(ids) },
      relations: ['role'],
    });

    return entities.map((user) => UserMapper.toDomain(user));
  }

  async findByEmail(email: User['email']): Promise<NullableType<User>> {
    if (!email) return null;

    const entity = await this.usersRepository.findOne({
      where: { email },
      relations: ['role'],
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByUsername(username: string): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: { username },
      relations: ['role'],
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async findByEmailOrUsername(identifier: string): Promise<NullableType<User>> {
    const entity = await this.usersRepository.findOne({
      where: [{ email: identifier }, { username: identifier }],
      relations: ['role'],
    });

    return entity ? UserMapper.toDomain(entity) : null;
  }

  async update(id: User['id'], payload: Partial<User>): Promise<User> {
    const entity = await this.usersRepository.findOne({
      where: { id },
      relations: ['role'],
    });

    if (!entity) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const updatedEntity = await this.usersRepository.save(
      this.usersRepository.create(
        UserMapper.toPersistence({
          ...UserMapper.toDomain(entity),
          ...payload,
        }),
      ),
    );

    return UserMapper.toDomain(updatedEntity);
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.update(id, { isActive: false });
  }

  async restore(id: User['id']): Promise<User> {
    const entity = await this.usersRepository.findOne({ where: { id }, relations: ['role'] });
    if (!entity) throw new NotFoundException('Usuario no encontrado');
    if (!entity.isActive) {
      await this.usersRepository.update(id, { isActive: true });
      entity.isActive = true;
    }
    return UserMapper.toDomain(entity);
  }
}
