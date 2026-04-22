import bcrypt from 'bcryptjs';
import { HttpStatus, Injectable, UnprocessableEntityException } from '@nestjs/common';

import { User } from './domain/user';
import { Role } from '../roles/domain/role';
import { NullableType, IPaginationOptions } from '@/common/utils/types';
import { UserRepository } from './infrastructure/persistence/user.repository';
import { SortUserDto, CreateUserDto, FilterUserDto, UpdateUserDto } from './dto';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UserRepository) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    let password: string | undefined = undefined;

    if (createUserDto.password) {
      const salt = await bcrypt.genSalt();
      password = await bcrypt.hash(createUserDto.password, salt);
    }

    if (createUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(createUserDto.email);
      if (userObject) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: 'emailAlreadyExists' },
        });
      }
    }

    const existingUsername = await this.usersRepository.findByUsername(createUserDto.username);
    if (existingUsername) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { username: 'usernameAlreadyExists' },
      });
    }

    let role: Role | undefined = undefined;
    if (createUserDto.role?.id) {
      role = { id: createUserDto.role.id };
    }

    return this.usersRepository.create({
      username: createUserDto.username,
      password: password,
      fullName: createUserDto.fullName,
      cedula: createUserDto.cedula ?? null,
      email: createUserDto.email ?? null,
      phone: createUserDto.phone ?? null,
      role: role,
      isActive: true,
      lastLoginAt: null,
    });
  }

  findManyWithPagination({
    filterOptions,
    sortOptions,
    paginationOptions,
  }: {
    filterOptions?: FilterUserDto | null;
    sortOptions?: SortUserDto[] | null;
    paginationOptions: IPaginationOptions;
  }): Promise<User[]> {
    return this.usersRepository.findManyWithPagination({
      filterOptions,
      sortOptions,
      paginationOptions,
    });
  }

  findById(id: User['id']): Promise<NullableType<User>> {
    return this.usersRepository.findById(id);
  }

  findByIds(ids: User['id'][]): Promise<User[]> {
    return this.usersRepository.findByIds(ids);
  }

  findByEmail(email: User['email']): Promise<NullableType<User>> {
    return this.usersRepository.findByEmail(email);
  }

  findByEmailOrUsername(identifier: string): Promise<NullableType<User>> {
    return this.usersRepository.findByEmailOrUsername(identifier);
  }

  async update(id: User['id'], updateUserDto: UpdateUserDto): Promise<User | null> {
    let password: string | undefined = undefined;

    if (updateUserDto.password) {
      const userObject = await this.usersRepository.findById(id);
      if (userObject && userObject?.password !== updateUserDto.password) {
        const salt = await bcrypt.genSalt();
        password = await bcrypt.hash(updateUserDto.password, salt);
      }
    }

    let email: string | null | undefined = undefined;
    if (updateUserDto.email) {
      const userObject = await this.usersRepository.findByEmail(updateUserDto.email);
      if (userObject && userObject.id !== id) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { email: 'emailAlreadyExists' },
        });
      }
      email = updateUserDto.email;
    } else if (updateUserDto.email === null) {
      email = null;
    }

    let role: Role | undefined = undefined;
    if (updateUserDto.role?.id) {
      role = { id: updateUserDto.role.id };
    }

    return this.usersRepository.update(id, {
      fullName: updateUserDto.fullName,
      cedula: updateUserDto.cedula,
      email,
      phone: updateUserDto.phone,
      password,
      role,
      isActive: updateUserDto.isActive,
    });
  }

  async remove(id: User['id']): Promise<void> {
    await this.usersRepository.remove(id);
  }

  async restore(id: User['id']): Promise<User> {
    return this.usersRepository.restore(id);
  }
}
