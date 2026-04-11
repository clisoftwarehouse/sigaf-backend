import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleEntity } from './infrastructure/persistence/relational/entities/role.entity';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) {}

  async findAll() {
    return this.roleRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: string) {
    return this.roleRepository.findOne({ where: { id } });
  }

  async findByName(name: string) {
    return this.roleRepository.findOne({ where: { name } });
  }
}
