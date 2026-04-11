import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { GlobalConfigEntity } from './infrastructure/persistence/relational/entities/global-config.entity';

@Injectable()
export class ConfigGlobalService {
  constructor(
    @InjectRepository(GlobalConfigEntity)
    private readonly repo: Repository<GlobalConfigEntity>,
  ) {}

  async findAll(): Promise<Record<string, string>> {
    const items = await this.repo.find();
    const result: Record<string, string> = {};
    items.forEach((item) => {
      result[item.key] = item.value;
    });
    return result;
  }

  async get(key: string): Promise<string | null> {
    const item = await this.repo.findOne({ where: { key } });
    return item?.value || null;
  }

  async set(key: string, value: string, userId?: string): Promise<GlobalConfigEntity> {
    let item = await this.repo.findOne({ where: { key } });
    if (item) {
      item.value = value;
      item.updatedBy = userId || null;
    } else {
      item = this.repo.create({ key, value, updatedBy: userId || null });
    }
    return this.repo.save(item);
  }

  async setMany(data: Record<string, string>, userId?: string): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(data)) {
      await this.set(key, value, userId);
    }
    return this.findAll();
  }
}
