import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository, DataSource } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { QueryPrescriptionDto, CreatePrescriptionDto, UpdatePrescriptionDto } from './dto';
import { PrescriptionEntity } from './infrastructure/persistence/relational/entities/prescription.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { PrescriptionItemEntity } from './infrastructure/persistence/relational/entities/prescription-item.entity';
import { CustomerEntity } from '@/modules/customers/infrastructure/persistence/relational/entities/customer.entity';
import { PrescriberEntity } from '@/modules/prescribers/infrastructure/persistence/relational/entities/prescriber.entity';

export type DispenseInput = {
  items: Array<{
    prescriptionItemId: string;
    quantity: number;
  }>;
};

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
    @InjectRepository(PrescriberEntity)
    private readonly prescriberRepo: Repository<PrescriberEntity>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Busca un médico en el catálogo por cédula o por nombre normalizado.
   * Si no existe, lo crea con los datos provistos. Asegura que cada récipe
   * cargado desde el POS también alimente el catálogo de Médicos en lugar
   * de quedar como texto suelto.
   */
  private async findOrCreatePrescriber(
    doctorName: string,
    doctorIdNumber: string | null,
    manager: import('typeorm').EntityManager,
  ): Promise<PrescriberEntity | null> {
    const name = doctorName?.trim();
    if (!name) return null;
    const idNumber = doctorIdNumber?.trim() ?? null;
    const repo = manager.getRepository(PrescriberEntity);

    // 1. Match exacto por cédula o MPPS si vino. Esto es lo más fiable —
    //    dos médicos pueden compartir nombre pero no cédula.
    if (idNumber) {
      const existing = await repo
        .createQueryBuilder('p')
        .where('p.nationalId = :id OR p.mppsNumber = :id', { id: idNumber })
        .getOne();
      if (existing) return existing;
    }

    // 2. Fallback: match por nombre exacto (case-insensitive). Si hay
    //    duplicados con mismo nombre, usamos el primero. El admin puede
    //    consolidarlos manualmente después.
    const byName = await repo.createQueryBuilder('p').where('LOWER(p.fullName) = LOWER(:name)', { name }).getOne();
    if (byName) return byName;

    // 3. Crear nuevo médico con los datos disponibles.
    const created = repo.create({
      fullName: name,
      nationalId: idNumber,
      mppsNumber: null,
      isActive: true,
    });
    return repo.save(created);
  }

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
    // Idempotencia para el POS offline: si el récipe ya existe con el id que
    // mandó el cliente (reintento de sync), lo devolvemos tal cual en vez de
    // duplicar. El sync engine puede reintentar el POST sin miedo.
    if (dto.id) {
      const existing = await this.prescriptionRepo.findOne({
        where: { id: dto.id },
        relations: ['customer', 'items', 'items.product'],
      });
      if (existing) return existing;
    }

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
      // Buscar o crear el médico en el catálogo para que cada récipe del
      // POS también alimente el listado de Médicos. Si falla por cualquier
      // motivo, seguimos con doctorName como texto suelto (legacy fallback).
      const prescriber = await this.findOrCreatePrescriber(dto.doctorName, dto.doctorIdNumber ?? null, manager).catch(
        () => null,
      );

      const presc = manager.create(PrescriptionEntity, {
        // Respetamos el id del cliente (POS offline) si vino; sino lo genera la DB.
        ...(dto.id ? { id: dto.id } : {}),
        customerId: dto.customerId,
        doctorName: dto.doctorName,
        doctorIdNumber: dto.doctorIdNumber ?? null,
        prescriberId: prescriber?.id ?? null,
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
          // Mismo criterio para los items: el ticket offline referencia este id.
          ...(i.id ? { id: i.id } : {}),
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

  /**
   * Récipes con saldo pendiente para un cliente: status active o
   * partially_dispensed, no vencidos, con al menos un item con
   * quantity_dispensed < quantity_prescribed. Usado por el POS para
   * preguntarle al cajero "este cliente ya tiene récipe cargado".
   */
  async findPendingByCustomer(customerId: string): Promise<PrescriptionEntity[]> {
    const now = new Date();
    const prescs = await this.prescriptionRepo.find({
      where: { customerId, status: In(['active', 'partially_dispensed']) },
      relations: ['items', 'items.product'],
      order: { issuedAt: 'DESC' },
    });
    return prescs.filter((p) => {
      if (p.expiresAt && p.expiresAt < now) return false;
      const hasRemaining = (p.items ?? []).some((i) => Number(i.quantityDispensed) < Number(i.quantityPrescribed));
      return hasRemaining;
    });
  }

  /**
   * Registra dispensación parcial o total de un récipe. Valida que cada
   * item no exceda quantity_prescribed - quantity_dispensed y actualiza
   * el status del récipe automáticamente:
   *   - active → partially_dispensed (si quedan saldos > 0)
   *   - active/partially → fully_dispensed (si todos quedan en 0 restantes)
   *
   * Idempotencia: NO controla acá. El POS llama una vez al cerrar venta y
   * usa el ticket como referencia. Si la misma dispensación se llama 2x,
   * sumará dos veces. El operador debe revertir manualmente desde admin.
   */
  async dispense(prescriptionId: string, input: DispenseInput): Promise<PrescriptionEntity> {
    if (!input.items || input.items.length === 0) {
      throw new BadRequestException('Debe indicar al menos un item a dispensar');
    }

    return this.dataSource.transaction(async (manager) => {
      const presc = await manager.findOne(PrescriptionEntity, {
        where: { id: prescriptionId },
        relations: ['items'],
      });
      if (!presc) throw new NotFoundException('Récipe no encontrado');
      if (presc.status === 'cancelled') {
        throw new BadRequestException('Récipe anulado, no se puede dispensar');
      }
      if (presc.status === 'fully_dispensed') {
        throw new BadRequestException('Récipe ya completamente dispensado');
      }
      if (presc.expiresAt && presc.expiresAt < new Date()) {
        throw new BadRequestException('Récipe vencido');
      }

      const itemMap = new Map(presc.items.map((i) => [i.id, i]));

      // Validar y actualizar cada item solicitado.
      for (const req of input.items) {
        const item = itemMap.get(req.prescriptionItemId);
        if (!item) {
          throw new BadRequestException(`Item ${req.prescriptionItemId} no pertenece a este récipe`);
        }
        const qty = Number(req.quantity);
        if (!Number.isFinite(qty) || qty <= 0) {
          throw new BadRequestException('Cantidad a dispensar debe ser mayor a cero');
        }
        const dispensed = Number(item.quantityDispensed) || 0;
        const prescribed = Number(item.quantityPrescribed) || 0;
        const remaining = prescribed - dispensed;
        if (qty > remaining + 0.0001) {
          throw new BadRequestException(`Item excede saldo. Pedido: ${qty}, saldo: ${remaining.toFixed(3)}`);
        }
        item.quantityDispensed = dispensed + qty;
        await manager.save(item);
      }

      // Recargar items y recalcular status.
      const items = await manager.find(PrescriptionItemEntity, {
        where: { prescriptionId },
      });
      const allFull = items.every((i) => Number(i.quantityDispensed) >= Number(i.quantityPrescribed));
      const anyDispensed = items.some((i) => Number(i.quantityDispensed) > 0);

      if (allFull) presc.status = 'fully_dispensed';
      else if (anyDispensed) presc.status = 'partially_dispensed';
      await manager.save(presc);

      return manager.findOneOrFail(PrescriptionEntity, {
        where: { id: prescriptionId },
        relations: ['customer', 'items', 'items.product'],
      });
    });
  }
}
