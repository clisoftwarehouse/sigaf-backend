import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateBranchDto, UpdateBranchDto } from './dto';
import { BranchEntity } from './infrastructure/persistence/relational/entities/branch.entity';

@Injectable()
export class BranchesService {
  constructor(
    @InjectRepository(BranchEntity)
    private readonly branchRepo: Repository<BranchEntity>,
  ) {}

  async findAll(): Promise<BranchEntity[]> {
    return this.branchRepo.find({ where: { isActive: true } });
  }

  async findOne(id: string): Promise<BranchEntity> {
    const branch = await this.branchRepo.findOne({ where: { id } });
    if (!branch) throw new NotFoundException('Sucursal no encontrada');
    return branch;
  }

  async create(dto: CreateBranchDto): Promise<BranchEntity> {
    const branch = this.branchRepo.create(dto);
    return this.branchRepo.save(branch);
  }

  async update(id: string, dto: UpdateBranchDto): Promise<BranchEntity> {
    const branch = await this.findOne(id);
    Object.assign(branch, dto);
    return this.branchRepo.save(branch);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.branchRepo.update(id, { isActive: false });
    return { success: true };
  }
}
