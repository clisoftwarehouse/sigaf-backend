import { Not, IsNull, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';

import { CreateCategoryDto, UpdateCategoryDto } from './dto';
import { CategoryEntity } from './infrastructure/persistence/relational/entities/category.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

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
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async findAll(filter?: { isActive?: boolean }): Promise<CategoryTree[]> {
    const where = filter?.isActive === undefined ? {} : { isActive: filter.isActive };
    const categories = await this.categoryRepo.find({ where });
    return this.buildTree(categories);
  }

  async findOne(id: string): Promise<CategoryEntity> {
    const category = await this.categoryRepo.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Categoría no encontrada');
    return category;
  }

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    if (dto.code) {
      const codeTaken = await this.categoryRepo.findOne({ where: { code: dto.code, isActive: true } });
      if (codeTaken) throw new ConflictException(`Código de categoría '${dto.code}' ya registrado`);
    }
    const sameName = await this.categoryRepo.findOne({
      where: { name: dto.name, parentId: dto.parentId ?? IsNull() },
    });
    if (sameName) {
      if (sameName.isActive) {
        throw new ConflictException(`Categoría '${dto.name}' ya existe`);
      }
      Object.assign(sameName, dto, { isActive: true });
      return this.categoryRepo.save(sameName);
    }
    const category = this.categoryRepo.create(dto);
    return this.categoryRepo.save(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    const category = await this.findOne(id);
    if (dto.parentId === id) {
      throw new NotFoundException('No se puede asignar a sí misma como padre');
    }
    if (dto.code && dto.code !== category.code) {
      const exists = await this.categoryRepo.findOne({ where: { code: dto.code, isActive: true, id: Not(id) } });
      if (exists) throw new ConflictException(`Código de categoría '${dto.code}' ya registrado`);
    }
    Object.assign(category, dto);
    return this.categoryRepo.save(category);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    const linkedProducts = await this.productRepo.count({ where: { categoryId: id, isActive: true } });
    if (linkedProducts > 0) {
      throw new ConflictException(
        `No se puede inactivar la categoría: ${linkedProducts} producto(s) activo(s) la referencian`,
      );
    }
    const childCount = await this.categoryRepo.count({ where: { parentId: id, isActive: true } });
    if (childCount > 0) {
      throw new ConflictException(`No se puede inactivar la categoría: tiene ${childCount} subcategoría(s) activa(s)`);
    }
    await this.categoryRepo.update(id, { isActive: false });
    return { success: true };
  }

  async restore(id: string): Promise<CategoryEntity> {
    const category = await this.findOne(id);
    if (category.isActive) return category;
    category.isActive = true;
    return this.categoryRepo.save(category);
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
