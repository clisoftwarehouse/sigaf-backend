import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { SupplierEntity } from './infrastructure/persistence/relational/entities/supplier.entity';
import { SupplierProductEntity } from './infrastructure/persistence/relational/entities/supplier-product.entity';
import { SupplierContactEntity } from './infrastructure/persistence/relational/entities/supplier-contact.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreateSupplierProductDto,
  UpdateSupplierProductDto,
  CreateSupplierContactDto,
  UpdateSupplierContactDto,
} from './dto';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(SupplierProductEntity)
    private readonly supplierProductRepo: Repository<SupplierProductEntity>,
    @InjectRepository(SupplierContactEntity)
    private readonly supplierContactRepo: Repository<SupplierContactEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
  ) {}

  async findAll(query: { search?: string; isDrugstore?: boolean; isActive?: boolean }): Promise<SupplierEntity[]> {
    const qb = this.supplierRepo.createQueryBuilder('s');

    if (query.search) {
      qb.andWhere('(s.businessName ILIKE :search OR s.tradeName ILIKE :search OR s.rif ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    if (query.isDrugstore !== undefined) {
      qb.andWhere('s.isDrugstore = :isDrugstore', { isDrugstore: query.isDrugstore });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    } else {
      qb.andWhere('s.isActive = true');
    }

    return qb.orderBy('s.businessName', 'ASC').getMany();
  }

  async findOne(id: string): Promise<SupplierEntity> {
    const supplier = await this.supplierRepo.findOne({ where: { id } });
    if (!supplier) throw new NotFoundException('Proveedor no encontrado');
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<SupplierEntity> {
    const supplier = this.supplierRepo.create(dto);
    return this.supplierRepo.save(supplier);
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<SupplierEntity> {
    const supplier = await this.findOne(id);
    Object.assign(supplier, dto);
    return this.supplierRepo.save(supplier);
  }

  async remove(id: string): Promise<{ success: boolean }> {
    await this.findOne(id);
    await this.supplierRepo.update(id, { isActive: false });
    return { success: true };
  }

  async findSupplierProducts(supplierId: string): Promise<
    Array<{
      id: string;
      productId: string;
      productDescription: string;
      productEan: string | null;
      supplierSku: string | null;
      costUsd: number | null;
      lastCostUsd: number | null;
      discountPct: number;
      isAvailable: boolean;
      lastUpdatedAt: Date;
    }>
  > {
    await this.findOne(supplierId);
    const links = await this.supplierProductRepo.find({
      where: { supplierId },
      relations: ['product'],
      order: { lastUpdatedAt: 'DESC' },
    });
    return links.map((sp) => ({
      id: sp.id,
      productId: sp.productId,
      productDescription: sp.product?.description ?? '',
      productEan: sp.product?.ean ?? null,
      supplierSku: sp.supplierSku,
      costUsd: sp.costUsd,
      lastCostUsd: sp.lastCostUsd,
      discountPct: sp.discountPct,
      isAvailable: sp.isAvailable,
      lastUpdatedAt: sp.lastUpdatedAt,
    }));
  }

  async createSupplierProduct(supplierId: string, dto: CreateSupplierProductDto): Promise<SupplierProductEntity> {
    await this.findOne(supplierId);

    const product = await this.productRepo.findOne({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Producto no encontrado');

    const existing = await this.supplierProductRepo.findOne({
      where: { supplierId, productId: dto.productId },
    });
    if (existing) throw new ConflictException('El producto ya está asignado a este proveedor');

    const link = this.supplierProductRepo.create({
      supplierId,
      productId: dto.productId,
      supplierSku: dto.supplierSku ?? null,
      costUsd: dto.costUsd ?? null,
      lastCostUsd: null,
      discountPct: dto.discountPct ?? 0,
      isAvailable: dto.isAvailable ?? true,
    });
    return this.supplierProductRepo.save(link);
  }

  async updateSupplierProduct(
    supplierId: string,
    supplierProductId: string,
    dto: UpdateSupplierProductDto,
  ): Promise<SupplierProductEntity> {
    const link = await this.supplierProductRepo.findOne({
      where: { id: supplierProductId, supplierId },
    });
    if (!link) throw new NotFoundException('Asignación de producto no encontrada');

    if (dto.costUsd !== undefined && dto.costUsd !== Number(link.costUsd)) {
      link.lastCostUsd = link.costUsd;
      link.costUsd = dto.costUsd;
    }
    if (dto.supplierSku !== undefined) link.supplierSku = dto.supplierSku;
    if (dto.discountPct !== undefined) link.discountPct = dto.discountPct;
    if (dto.isAvailable !== undefined) link.isAvailable = dto.isAvailable;

    return this.supplierProductRepo.save(link);
  }

  async findSupplierContacts(supplierId: string): Promise<SupplierContactEntity[]> {
    await this.findOne(supplierId);
    return this.supplierContactRepo.find({
      where: { supplierId },
      order: { isPrimary: 'DESC', fullName: 'ASC' },
    });
  }

  async createSupplierContact(supplierId: string, dto: CreateSupplierContactDto): Promise<SupplierContactEntity> {
    await this.findOne(supplierId);
    if (dto.isPrimary) await this.clearPrimaryFlag(supplierId);
    const contact = this.supplierContactRepo.create({ ...dto, supplierId });
    return this.supplierContactRepo.save(contact);
  }

  async updateSupplierContact(
    supplierId: string,
    contactId: string,
    dto: UpdateSupplierContactDto,
  ): Promise<SupplierContactEntity> {
    const contact = await this.supplierContactRepo.findOne({ where: { id: contactId, supplierId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    if (dto.isPrimary && !contact.isPrimary) await this.clearPrimaryFlag(supplierId);
    Object.assign(contact, dto);
    return this.supplierContactRepo.save(contact);
  }

  async removeSupplierContact(supplierId: string, contactId: string): Promise<{ success: boolean }> {
    const contact = await this.supplierContactRepo.findOne({ where: { id: contactId, supplierId } });
    if (!contact) throw new NotFoundException('Contacto no encontrado');
    await this.supplierContactRepo.delete(contactId);
    return { success: true };
  }

  private async clearPrimaryFlag(supplierId: string): Promise<void> {
    await this.supplierContactRepo.update({ supplierId, isPrimary: true }, { isPrimary: false });
  }
}
