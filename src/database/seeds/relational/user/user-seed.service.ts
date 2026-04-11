import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

@Injectable()
export class UserSeedService {
  constructor(
    @InjectRepository(UserEntity)
    private repository: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private roleRepository: Repository<RoleEntity>,
  ) {}

  async run() {
    const adminRole = await this.roleRepository.findOne({ where: { name: 'administrador' } });
    if (!adminRole) {
      console.log('Admin role not found, skipping user seed');
      return;
    }

    const exists = await this.repository.count({ where: { username: 'admin' } });
    if (!exists) {
      const salt = await bcrypt.genSalt(12);
      const password = await bcrypt.hash('admin123', salt);

      await this.repository.save(
        this.repository.create({
          username: 'admin',
          password,
          fullName: 'Administrador del Sistema',
          cedula: 'V-00000000',
          email: 'admin@sigaf.com',
          phone: '+58412000000',
          roleId: adminRole.id,
          isActive: true,
        }),
      );
      console.log("User 'admin' created with password 'admin123'");
    }
  }
}
