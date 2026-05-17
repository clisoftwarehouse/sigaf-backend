import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { QueryPrescriptionDto, CreatePrescriptionDto, UpdatePrescriptionDto } from './dto';
import { PrescriptionEntity } from './infrastructure/persistence/relational/entities/prescription.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { PrescriptionItemEntity } from './infrastructure/persistence/relational/entities/prescription-item.entity';
import { CustomerEntity } from '@/modules/customers/infrastructure/persistence/relational/entities/customer.entity';

const DEFAULT_VIGENCIA_DAYS = 30;

@Injectable()
export class PrescriptionsService {
  constructor(
    @InjectRepository(PrescriptionEntity)
    private readonly prescriptionRepo: Repository<PrescriptionEntity>,
    @InjectRepository(PrescriptionItemEntity)
    private readonly itemRepo: Repository<PrescriptionItemEntity>,
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryPrescriptionDto): Promise<{
    data: PrescriptionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.prescriptionRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.customer', 'c')
      .leftJoinAndSelect('p.items', 'i')
      .leftJoinAndSelect('i.product', 'prod');

    if (query.customerId) qb.andWhere('p.customerId = :cid', { cid: query.customerId });
    if (query.status) qb.andWhere('p.status = :st', { st: query.status });
    if (query.search) {
      qb.andWhere('(p.doctorName ILIKE :s OR p.prescriptionNumber ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('p.issuedAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<PrescriptionEntity> {
    const presc = await this.prescriptionRepo.findOne({
      where: { id },
      relations: ['customer', 'items', 'items.product'],
    });
    if (!presc) throw new NotFoundException('Récipe no encontrado');
    return presc;
  }

  async create(dto: CreatePrescriptionDto, userId?: string | null): Promise<PrescriptionEntity> {
    const customer = await this.customerRepo.findOne({
      where: { id: dto.customerId, isActive: true },
    });
    if (!customer) throw new BadRequestException('Cliente no encontrado o inactivo');

    // Validar productos: existen y, si requireRecipe=false, advertir (no
    // bloqueamos: tener récipe de un OTC no rompe nada).
    const productIds = dto.items.map((i) => i.productId);
    const products = await this.productRepo.find({
      where: productIds.map((id) => ({ id })),
    });
    if (products.length !== productIds.length) {
      throw new BadRequestException('Uno o más productos no existen');
    }

    const issuedAt = new Date(dto.issuedAt);
    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(issuedAt.getTime() + DEFAULT_VIGENCIA_DAYS * 24 * 3600 * 1000);

    if (expiresAt <= issuedAt) {
      throw new BadRequestException('expiresAt debe ser posterior a issuedAt');
    }

    return this.dataSource.transaction(async (manager) => {
      const presc = manager.create(PrescriptionEntity, {
        customerId: dto.customerId,
        doctorName: dto.doctorName,
        doctorIdNumber: dto.doctorIdNumber ?? null,
        prescriptionNumber: dto.prescriptionNumber ?? null,
        issuedAt,
        expiresAt,
        status: 'active',
        notes: dto.notes ?? null,
        imageUrl: dto.imageUrl ?? null,
        createdBy: userId ?? null,
      });
      const saved = await manager.save(presc);

      const items = dto.items.map((i) =>
        manager.create(PrescriptionItemEntity, {
          prescriptionId: saved.id,
          productId: i.productId,
          quantityPrescribed: i.quantityPrescribed,
          quantityDispensed: 0,
          posology: i.posology ?? null,
          notes: i.notes ?? null,
        }),
      );
      await manager.save(items);

      return manager.findOneOrFail(PrescriptionEntity, {
        where: { id: saved.id },
        relations: ['customer', 'items', 'items.product'],
      });
    });
  }

  async update(id: string, dto: UpdatePrescriptionDto): Promise<PrescriptionEntity> {
    const presc = await this.findOne(id);
    if (presc.status === 'cancelled') {
      throw new BadRequestException('No se puede editar un récipe anulado');
    }
    if (presc.status === 'fully_dispensed') {
      throw new BadRequestException('No se puede editar un récipe completamente dispensado');
    }

    const patch: Partial<PrescriptionEntity> = {};
    if (dto.doctorName !== undefined) patch.doctorName = dto.doctorName;
    if (dto.doctorIdNumber !== undefined) patch.doctorIdNumber = dto.doctorIdNumber;
    if (dto.prescriptionNumber !== undefined) patch.prescriptionNumber = dto.prescriptionNumber;
    if (dto.issuedAt !== undefined) patch.issuedAt = new Date(dto.issuedAt);
    if (dto.expiresAt !== undefined) patch.expiresAt = new Date(dto.expiresAt);
    if (dto.notes !== undefined) patch.notes = dto.notes;
    if (dto.imageUrl !== undefined) patch.imageUrl = dto.imageUrl;

    Object.assign(presc, patch);
    await this.prescriptionRepo.save(presc);
    return this.findOne(id);
  }

  async cancel(id: string): Promise<PrescriptionEntity> {
    const presc = await this.findOne(id);
    if (presc.status === 'cancelled') return presc;
    if (presc.status === 'fully_dispensed') {
      throw new BadRequestException('No se puede anular un récipe completamente dispensado; usa devolución de venta');
    }
    presc.status = 'cancelled';
    await this.prescriptionRepo.save(presc);
    return this.findOne(id);
  }
}
