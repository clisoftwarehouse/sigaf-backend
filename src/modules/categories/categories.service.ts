import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CategoryEntity } from './infrastructure/persistence/relational/entities/category.entity';

export interface CategoryTree {
  id: string;
  parentId: string | null;
  name: string;
  code: string | null;
  isPharmaceutical: boolean;
  isActive: boolean;
  createdAt: Date;
  children?: CategoryTree[];
}

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(CategoryEntity)
    private readonly categoryRepo: Repository<CategoryEntity>,
  ) {}

  async findAll(): Promise<CategoryTree[]> {
    const categories = await this.categoryRepo.find({ where: { isActive: true } });
    return this.buildTree(categories);
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.findOne(id);
    if (dto.parentId === id) {
      throw new NotFoundException('No se puede asignar a sí misma como padre');
    }
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.categoryRepo.update(id, { isActive: false });
    return { success: true };
  }

  private buildTree(categories: CategoryEntity[]): CategoryTree[] {
    const map = new Map<string, CategoryTree>();
    const roots: CategoryTree[] = [];

    categories.forEach((cat) => map.set(cat.id, { ...cat, children: [] }));

    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parentId && map.has(cat.parentId)) {
        map.get(cat.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
