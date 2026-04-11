import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateTerminalDto, UpdateTerminalDto } from './dto';
import { TerminalEntity } from './infrastructure/persistence/relational/entities/terminal.entity';

@Injectable()
export class TerminalsService {
  constructor(
    @InjectRepository(TerminalEntity)
    private readonly repo: Repository<TerminalEntity>,
  ) {}

  async findAll(query: { branchId?: string }): Promise<TerminalEntity[]> {
    const where: Record<string, unknown> = { isActive: true };
    if (query.branchId) where.branchId = query.branchId;
    return this.repo.find({ where });
  }

  async findOne(id: string): Promise<TerminalEntity> {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Terminal no encontrado');
    return item;
  }

  async create(dto: CreateTerminalDto): Promise<TerminalEntity> {
    const item = this.repo.create(dto);
    return this.repo.save(item);
  }

  async update(id: string, dto: UpdateTerminalDto): Promise<TerminalEntity> {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.repo.update(id, { isActive: false });
    return { success: true };
  }
}
