import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';

const ROLES = [
  { name: 'administrador', description: 'Administrador del sistema con acceso total a todos los módulos' },
  { name: 'farmaceutico_regente', description: 'Farmacéutico regente con acceso a productos, inventario y auditoría' },
  { name: 'cajero', description: 'Cajero con acceso a POS, vista de productos e inventario' },
  {
    name: 'gerente_inventario',
    description: 'Gerente de inventario con acceso a productos, inventario, compras y proveedores',
  },
];

@Injectable()
export class RoleSeedService {
  constructor(
    @InjectRepository(RoleEntity)
    private repository: Repository<RoleEntity>,
  ) {}

  async run() {
    for (const role of ROLES) {
      const exists = await this.repository.count({ where: { name: role.name } });
      if (!exists) {
        await this.repository.save(this.repository.create(role));
        console.log(`Role '${role.name}' created`);
      }
    }
  }
}
