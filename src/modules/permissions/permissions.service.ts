import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { PermissionEntity } from './infrastructure/persistence/relational/entities/permission.entity';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(PermissionEntity)
    private readonly repo: Repository<PermissionEntity>,
  ) {}

  async findAll(): Promise<PermissionEntity[]> {
    return this.repo.find({ order: { module: 'ASC', code: 'ASC' } });
  }

  async findByModule(module: string): Promise<PermissionEntity[]> {
    return this.repo.find({ where: { module }, order: { code: 'ASC' } });
  }
}
