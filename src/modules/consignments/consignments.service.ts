import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { ConsignmentEntryEntity } from './infrastructure/persistence/relational/entities/consignment-entry.entity';
import { ConsignmentReturnEntity } from './infrastructure/persistence/relational/entities/consignment-return.entity';
import { ConsignmentEntryItemEntity } from './infrastructure/persistence/relational/entities/consignment-entry-item.entity';
import { ConsignmentReturnItemEntity } from './infrastructure/persistence/relational/entities/consignment-return-item.entity';
import { ConsignmentLiquidationEntity } from './infrastructure/persistence/relational/entities/consignment-liquidation.entity';
import { ConsignmentLiquidationItemEntity } from './infrastructure/persistence/relational/entities/consignment-liquidation-item.entity';
import {
  QueryConsignmentDto,
  CreateConsignmentEntryDto,
  CreateConsignmentReturnDto,
  CreateConsignmentLiquidationDto,
} from './dto';

@Injectable()
export class ConsignmentsService {
  constructor(
    @InjectRepository(ConsignmentEntryEntity)
    private readonly entryRepo: Repository<ConsignmentEntryEntity>,
    @InjectRepository(ConsignmentEntryItemEntity)
    private readonly entryItemRepo: Repository<ConsignmentEntryItemEntity>,
    @InjectRepository(ConsignmentReturnEntity)
    private readonly returnRepo: Repository<ConsignmentReturnEntity>,
    @InjectRepository(ConsignmentReturnItemEntity)
    private readonly returnItemRepo: Repository<ConsignmentReturnItemEntity>,
    @InjectRepository(ConsignmentLiquidationEntity)
    private readonly liquidationRepo: Repository<ConsignmentLiquidationEntity>,
    @InjectRepository(ConsignmentLiquidationItemEntity)
    private readonly liquidationItemRepo: Repository<ConsignmentLiquidationItemEntity>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── ENTRIES ───────────────────────────────────────────────────────────

  async findAllEntries(
    query: QueryConsignmentDto,
  ): Promise<{ data: ConsignmentEntryEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.entryRepo.createQueryBuilder('e');

    if (query.branchId) qb.andWhere('e.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) qb.andWhere('e.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.status) qb.andWhere('e.status = :status', { status: query.status });
    if (query.from) qb.andWhere('e.entryDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('e.entryDate <= :to', { to: query.to });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('e.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneEntry(id: string): Promise<any> {
    const entry = await this.entryRepo.findOne({ where: { id } });
    if (!entry) throw new NotFoundException('Entrada de consignación no encontrada');

    const items = await this.entryItemRepo.find({
      where: { consignmentEntryId: id },
      order: { createdAt: 'ASC' },
    });

    return { ...entry, items };
  }

  async createEntry(dto: CreateConsignmentEntryDto, userId: string): Promise<any> {
    if (!dto.items.length) throw new BadRequestException('Debe incluir al menos un ítem');

    const entryNumber = await this.generateEntryNumber();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalCostUsd = 0;
      for (const item of dto.items) {
        totalCostUsd += item.quantity * item.costUsd;
      }

      const entry = this.entryRepo.create({
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        entryNumber,
        commissionPct: dto.commissionPct,
        notes: dto.notes || null,
        status: 'active',
        totalItems: dto.items.length,
        totalCostUsd,
        receivedBy: userId,
      });

      const savedEntry = await queryRunner.manager.save(entry);

      for (const item of dto.items) {
        const lot = await this.inventoryService.createLot(
          {
            productId: item.productId,
            branchId: dto.branchId,
            lotNumber: item.lotNumber,
            expirationDate: item.expirationDate,
            quantityReceived: item.quantity,
            costUsd: item.costUsd,
            salePrice: item.salePrice,
            acquisitionType: 'consignment',
            supplierId: dto.supplierId,
            consignmentEntryId: savedEntry.id,
          },
          userId,
        );

        const entryItem = this.entryItemRepo.create({
          consignmentEntryId: savedEntry.id,
          productId: item.productId,
          lotId: lot.id,
          quantity: item.quantity,
          costUsd: item.costUsd,
        });
        await queryRunner.manager.save(entryItem);
      }

      await queryRunner.commitTransaction();

      return this.findOneEntry(savedEntry.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── RETURNS ───────────────────────────────────────────────────────────

  async findAllReturns(query: {
    branchId?: string;
    supplierId?: string;
    consignmentEntryId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ConsignmentReturnEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.returnRepo.createQueryBuilder('r');

    if (query.branchId) qb.andWhere('r.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) qb.andWhere('r.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.consignmentEntryId) {
      qb.andWhere('r.consignmentEntryId = :ceId', { ceId: query.consignmentEntryId });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async createReturn(dto: CreateConsignmentReturnDto, userId: string): Promise<any> {
    if (!dto.items.length) throw new BadRequestException('Debe incluir al menos un ítem');

    const entry = await this.entryRepo.findOne({ where: { id: dto.consignmentEntryId } });
    if (!entry) throw new NotFoundException('Entrada de consignación no encontrada');
    if (entry.status !== 'active') throw new BadRequestException('Solo se pueden devolver consignaciones activas');

    const returnNumber = await this.generateReturnNumber();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ret = this.returnRepo.create({
        consignmentEntryId: dto.consignmentEntryId,
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        returnNumber,
        reason: dto.reason,
        notes: dto.notes || null,
        processedBy: userId,
      });

      const savedReturn = await queryRunner.manager.save(ret);

      for (const item of dto.items) {
        const entryItem = await this.entryItemRepo.findOne({ where: { id: item.consignmentItemId } });
        if (!entryItem) throw new NotFoundException(`Ítem de consignación ${item.consignmentItemId} no encontrado`);

        const availableQty =
          Number(entryItem.quantity) - Number(entryItem.quantityReturned) - Number(entryItem.quantitySold);
        if (item.quantity > availableQty) {
          throw new BadRequestException(
            `Cantidad a devolver excede lo disponible para el ítem ${item.consignmentItemId}`,
          );
        }

        entryItem.quantityReturned = Number(entryItem.quantityReturned) + item.quantity;
        await queryRunner.manager.save(entryItem);

        const returnItem = this.returnItemRepo.create({
          returnId: savedReturn.id,
          consignmentItemId: item.consignmentItemId,
          lotId: item.lotId,
          quantity: item.quantity,
          costUsd: item.costUsd,
        });
        await queryRunner.manager.save(returnItem);
      }

      await queryRunner.commitTransaction();

      await this.auditService.log({
        tableName: 'consignment_returns',
        recordId: savedReturn.id,
        action: 'INSERT',
        newValues: savedReturn,
        userId,
      });

      const returnItems = await this.returnItemRepo.find({ where: { returnId: savedReturn.id } });
      return { ...savedReturn, items: returnItems };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── LIQUIDATIONS ─────────────────────────────────────────────────────

  async findAllLiquidations(query: {
    branchId?: string;
    supplierId?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: ConsignmentLiquidationEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.liquidationRepo.createQueryBuilder('l');

    if (query.branchId) qb.andWhere('l.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) qb.andWhere('l.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.status) qb.andWhere('l.status = :status', { status: query.status });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('l.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneLiquidation(id: string): Promise<any> {
    const liquidation = await this.liquidationRepo.findOne({ where: { id } });
    if (!liquidation) throw new NotFoundException('Liquidación no encontrada');

    const items = await this.liquidationItemRepo.find({ where: { liquidationId: id } });
    return { ...liquidation, items };
  }

  async createLiquidation(dto: CreateConsignmentLiquidationDto, userId: string): Promise<any> {
    const liquidationNumber = await this.generateLiquidationNumber();

    const qb = this.entryItemRepo
      .createQueryBuilder('ei')
      .innerJoin('consignment_entries', 'ce', 'ce.id = ei.consignment_entry_id')
      .where('ce.supplier_id = :supplierId', { supplierId: dto.supplierId })
      .andWhere('ce.branch_id = :branchId', { branchId: dto.branchId })
      .andWhere("ce.status = 'active'")
      .andWhere('ei.quantity_sold > 0');

    if (dto.consignmentEntryId) {
      qb.andWhere('ce.id = :entryId', { entryId: dto.consignmentEntryId });
    }

    const soldItems = await qb.getMany();
    if (!soldItems.length) throw new BadRequestException('No hay ítems vendidos para liquidar');

    let totalSoldUsd = 0;
    const liquidationItems: Array<{
      consignmentItemId: string;
      quantityLiquidated: number;
      salePriceUsd: number;
      costUsd: number;
      commissionUsd: number;
    }> = [];

    for (const item of soldItems) {
      const entry = await this.entryRepo.findOne({
        where: { id: item.consignmentEntryId },
      });
      const commPct = entry ? Number(entry.commissionPct) : 0;

      const salePriceUsd = Number(item.costUsd) * 1.3;
      const itemTotal = Number(item.quantitySold) * salePriceUsd;
      const commissionUsd = itemTotal * (commPct / 100);

      totalSoldUsd += itemTotal;
      liquidationItems.push({
        consignmentItemId: item.id,
        quantityLiquidated: Number(item.quantitySold),
        salePriceUsd,
        costUsd: Number(item.costUsd),
        commissionUsd,
      });
    }

    const totalCommission = liquidationItems.reduce((sum, i) => sum + i.commissionUsd, 0);
    const amountDue = totalSoldUsd - totalCommission;

    const liquidation = this.liquidationRepo.create({
      branchId: dto.branchId,
      supplierId: dto.supplierId,
      liquidationNumber,
      periodStart: new Date(dto.periodStart),
      periodEnd: new Date(dto.periodEnd),
      totalSoldUsd,
      commissionUsd: totalCommission,
      amountDueUsd: amountDue,
      status: 'draft',
      createdBy: userId,
    });

    const saved = await this.liquidationRepo.save(liquidation);

    for (const li of liquidationItems) {
      const liqItem = this.liquidationItemRepo.create({
        liquidationId: saved.id,
        ...li,
      });
      await this.liquidationItemRepo.save(liqItem);
    }

    return this.findOneLiquidation(saved.id);
  }

  async approveLiquidation(id: string, userId: string): Promise<any> {
    const liquidation = await this.liquidationRepo.findOne({ where: { id } });
    if (!liquidation) throw new NotFoundException('Liquidación no encontrada');
    if (liquidation.status !== 'draft') {
      throw new BadRequestException('Solo se pueden aprobar liquidaciones en borrador');
    }

    liquidation.status = 'approved';
    liquidation.approvedBy = userId;
    liquidation.approvedAt = new Date();
    await this.liquidationRepo.save(liquidation);

    await this.auditService.log({
      tableName: 'consignment_liquidations',
      recordId: id,
      action: 'UPDATE',
      newValues: { status: 'approved', approvedBy: userId },
      userId,
    });

    return this.findOneLiquidation(id);
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────

  private async generateEntryNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.entryRepo
      .createQueryBuilder('e')
      .where('e.entryNumber LIKE :pattern', { pattern: `CE-${year}-%` })
      .getCount();
    return `CE-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateReturnNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.returnRepo
      .createQueryBuilder('r')
      .where('r.returnNumber LIKE :pattern', { pattern: `CR-${year}-%` })
      .getCount();
    return `CR-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateLiquidationNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.liquidationRepo
      .createQueryBuilder('l')
      .where('l.liquidationNumber LIKE :pattern', { pattern: `CL-${year}-%` })
      .getCount();
    return `CL-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
