import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';

import { QueryCustomerDto, CreateCustomerDto, UpdateCustomerDto } from './dto';
import { CustomerEntity } from './infrastructure/persistence/relational/entities/customer.entity';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
  ) {}

  async findAll(query: QueryCustomerDto): Promise<{
    data: CustomerEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.customerRepo.createQueryBuilder('c');

    if (query.search) {
      qb.andWhere('(c.full_name ILIKE :s OR c.document_number ILIKE :s OR c.phone ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.customerType) {
      qb.andWhere('c.customer_type = :type', { type: query.customerType });
    }
    if (query.isActive !== undefined) {
      qb.andWhere('c.is_active = :active', { active: query.isActive });
    } else {
      qb.andWhere('c.is_active = true');
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.full_name', 'ASC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<CustomerEntity> {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async findByDocument(documentType: string, documentNumber: string): Promise<CustomerEntity> {
    const normalizedNumber = documentNumber.trim();
    const customer = await this.customerRepo.findOne({
      where: {
        documentType: documentType.toUpperCase() as CustomerEntity['documentType'],
        documentNumber: normalizedNumber,
        isActive: true,
      },
    });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    return customer;
  }

  async create(dto: CreateCustomerDto, userId?: string | null): Promise<CustomerEntity> {
    const documentNumber = dto.documentNumber.trim();
    const documentType = dto.documentType.toUpperCase() as CustomerEntity['documentType'];

    // Si existe ACTIVO con mismo documento, rechazo. Si existe INACTIVO,
    // lo reactivamos con los datos nuevos en vez de duplicar.
    const existing = await this.customerRepo.findOne({
      where: { documentType, documentNumber },
    });
    if (existing) {
      if (existing.isActive) {
        throw new ConflictException(`Ya existe un cliente con documento ${documentType}-${documentNumber}`);
      }
      Object.assign(existing, dto, {
        documentType,
        documentNumber,
        isActive: true,
      });
      return this.customerRepo.save(existing);
    }

    const customer = this.customerRepo.create({
      ...dto,
      documentType,
      documentNumber,
      createdBy: userId ?? null,
    });
    try {
      return await this.customerRepo.save(customer);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async update(id: string, dto: UpdateCustomerDto): Promise<CustomerEntity> {
    const customer = await this.findOne(id);
    const patch: Partial<CustomerEntity> = { ...dto };
    if (dto.documentType) {
      patch.documentType = dto.documentType.toUpperCase() as CustomerEntity['documentType'];
    }
    if (dto.documentNumber) {
      patch.documentNumber = dto.documentNumber.trim();
    }
    Object.assign(customer, patch);
    try {
      return await this.customerRepo.save(customer);
    } catch (err) {
      throw this.translateUniqueViolation(err);
    }
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const customer = await this.findOne(id);
    if (!customer.isActive) return { success: true };
    customer.isActive = false;
    await this.customerRepo.save(customer);
    return { success: true };
  }

  async restore(id: string): Promise<CustomerEntity> {
    const customer = await this.customerRepo.findOne({ where: { id } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');
    if (customer.isActive) return customer;

    // Al reactivar, validar que no haya otro activo con el mismo documento.
    const conflict = await this.customerRepo.findOne({
      where: {
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
        isActive: true,
      },
    });
    if (conflict) {
      throw new ConflictException(
        `No se puede reactivar: otro cliente activo usa el documento ${customer.documentType}-${customer.documentNumber}`,
      );
    }

    customer.isActive = true;
    return this.customerRepo.save(customer);
  }

  private translateUniqueViolation(err: unknown): Error {
    const e = err as { code?: string; detail?: string };
    if (e?.code === '23505' && e.detail?.includes('document')) {
      return new ConflictException('Ya existe un cliente activo con ese documento');
    }
    return err as Error;
  }
}
