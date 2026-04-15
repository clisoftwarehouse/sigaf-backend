import { IsNull, DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCountEntity } from './infrastructure/persistence/relational/entities/inventory-count.entity';
import { InventoryCountItemEntity } from './infrastructure/persistence/relational/entities/inventory-count-item.entity';
import {
  QueryStockDto,
  QueryKardexDto,
  CancelCountDto,
  ApproveCountDto,
  QuarantineLotDto,
  CreateAdjustmentDto,
  CountItemUpdateDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
  BulkUpdateCountItemsDto,
  QueryInventoryCountDto,
  CreateInventoryCountDto,
} from './dto';

export interface ExpirySignalLot {
  id: string;
  productId: string;
  branchId: string;
  lotNumber: string;
  expirationDate: Date;
  manufactureDate: Date | null;
  acquisitionType: string;
  supplierId: string | null;
  consignmentEntryId: string | null;
  costUsd: number;
  salePrice: number;
  marginPct: number | null;
  quantityReceived: number;
  quantityAvailable: number;
  quantityReserved: number;
  quantitySold: number;
  quantityDamaged: number;
  quantityReturned: number;
  locationId: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  expirySignal: 'EXPIRED' | 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
}

export type InventoryCountWithItems = InventoryCountEntity & { items: InventoryCountItemEntity[] };

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
    @InjectRepository(InventoryCountEntity)
    private readonly countRepo: Repository<InventoryCountEntity>,
    @InjectRepository(InventoryCountItemEntity)
    private readonly countItemRepo: Repository<InventoryCountItemEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  async findAllLots(
    query: QueryInventoryLotDto,
  ): Promise<{ data: ExpirySignalLot[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.lotRepo.createQueryBuilder('lot');

    if (query.productId) {
      qb.andWhere('lot.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.status) {
      qb.andWhere('lot.status = :status', { status: query.status });
    }

    const [lots, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('lot.expirationDate', 'ASC')
      .getManyAndCount();

    const data = lots.map((lot) => this.addExpirySignal(lot));

    if (query.expirySignal) {
      const filtered = data.filter((lot) => lot.expirySignal === query.expirySignal);
      return { data: filtered, total: filtered.length, page, limit };
    }

    return { data, total, page, limit };
  }

  async findOneLot(id: string): Promise<ExpirySignalLot> {
    const lot = await this.lotRepo.findOne({ where: { id } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    return this.addExpirySignal(lot);
  }

  async createLot(dto: CreateInventoryLotDto, userId: string): Promise<InventoryLotEntity> {
    const marginPct = dto.salePrice > 0 && dto.costUsd > 0 ? ((dto.salePrice - dto.costUsd) / dto.costUsd) * 100 : null;

    const lot = this.lotRepo.create({
      ...dto,
      expirationDate: new Date(dto.expirationDate),
      manufactureDate: dto.manufactureDate ? new Date(dto.manufactureDate) : null,
      quantityAvailable: dto.quantityReceived,
      marginPct,
    });

    const saved = await this.lotRepo.save(lot);

    await this.createKardexEntry({
      productId: saved.productId,
      branchId: saved.branchId,
      lotId: saved.id,
      movementType: dto.acquisitionType === 'consignment' ? 'consignment_entry' : 'purchase_entry',
      quantity: dto.quantityReceived,
      unitCostUsd: dto.costUsd,
      referenceType: 'inventory_lot',
      referenceId: saved.id,
      userId,
    });

    return saved;
  }

  async updateLot(id: string, dto: UpdateInventoryLotDto, userId: string): Promise<InventoryLotEntity> {
    const lot = await this.findOneLot(id);
    const oldValues = { ...lot };

    Object.assign(lot, dto);
    const updated = await this.lotRepo.save(lot);

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: id,
      action: 'UPDATE',
      oldValues,
      newValues: updated,
      userId,
    });

    return updated;
  }

  async setQuarantine(id: string, dto: QuarantineLotDto, userId: string): Promise<InventoryLotEntity> {
    const lot = await this.findOneLot(id);
    const oldStatus = lot.status;

    lot.status = dto.quarantine ? 'quarantine' : 'available';
    const updated = await this.lotRepo.save(lot);

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: id,
      action: 'UPDATE',
      oldValues: { status: oldStatus },
      newValues: { status: lot.status },
      justification: dto.reason,
      userId,
    });

    return updated;
  }

  async getStockFefo(query: { productId?: string; branchId?: string }): Promise<ExpirySignalLot[]> {
    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .where("lot.status = 'available'")
      .andWhere('lot.quantityAvailable > 0');

    if (query.productId) {
      qb.andWhere('lot.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }

    const lots = await qb.orderBy('lot.expirationDate', 'ASC').getMany();

    return lots.map((lot) => this.addExpirySignal(lot));
  }

  async getStock(query: QueryStockDto): Promise<{
    data: Array<{
      productId: string;
      branchId: string;
      totalQuantity: number;
      lotCount: number;
      nearestExpiration: Date | null;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.lotRepo
      .createQueryBuilder('lot')
      .select('lot.productId', 'productId')
      .addSelect('lot.branchId', 'branchId')
      .addSelect('SUM(lot.quantityAvailable)', 'totalQuantity')
      .addSelect('COUNT(lot.id)', 'lotCount')
      .addSelect('MIN(lot.expirationDate)', 'nearestExpiration')
      .where("lot.status = 'available'")
      .groupBy('lot.productId')
      .addGroupBy('lot.branchId');

    if (query.productId) {
      qb.andWhere('lot.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('lot.branchId = :branchId', { branchId: query.branchId });
    }

    const rawData = await qb.getRawMany();

    let filteredData = rawData.map((row) => ({
      productId: row.productId,
      branchId: row.branchId,
      totalQuantity: parseFloat(row.totalQuantity) || 0,
      lotCount: parseInt(row.lotCount) || 0,
      nearestExpiration: row.nearestExpiration ? new Date(row.nearestExpiration) : null,
    }));

    if (query.stockStatus === 'out') {
      filteredData = filteredData.filter((item) => item.totalQuantity === 0);
    } else if (query.stockStatus === 'low') {
      filteredData = filteredData.filter((item) => item.totalQuantity > 0 && item.totalQuantity <= 10);
    }

    const total = filteredData.length;
    const paginatedData = filteredData.slice((page - 1) * limit, page * limit);

    return { data: paginatedData, total, page, limit };
  }

  async createAdjustment(dto: CreateAdjustmentDto, userId: string): Promise<KardexEntity> {
    const lot = await this.findOneLot(dto.lotId);

    const newQuantity = Number(lot.quantityAvailable) + dto.quantity;
    if (newQuantity < 0) {
      throw new NotFoundException('Cantidad insuficiente en el lote');
    }

    lot.quantityAvailable = newQuantity;
    if (dto.quantity < 0) {
      lot.quantityDamaged = Number(lot.quantityDamaged) + Math.abs(dto.quantity);
    }
    await this.lotRepo.save(lot);

    const movementType = dto.quantity > 0 ? 'adjustment_in' : 'adjustment_out';

    const kardex = await this.createKardexEntry({
      productId: dto.productId,
      branchId: dto.branchId,
      lotId: dto.lotId,
      movementType,
      quantity: dto.quantity,
      referenceType: 'adjustment',
      notes: `${dto.adjustmentType}: ${dto.reason}`,
      userId,
    });

    await this.auditService.log({
      tableName: 'inventory_lots',
      recordId: dto.lotId,
      action: 'UPDATE',
      justification: dto.reason,
      userId,
    });

    return kardex;
  }

  async findKardex(
    query: QueryKardexDto,
  ): Promise<{ data: KardexEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.kardexRepo.createQueryBuilder('k');

    if (query.productId) {
      qb.andWhere('k.productId = :productId', { productId: query.productId });
    }
    if (query.branchId) {
      qb.andWhere('k.branchId = :branchId', { branchId: query.branchId });
    }
    if (query.lotId) {
      qb.andWhere('k.lotId = :lotId', { lotId: query.lotId });
    }
    if (query.movementType) {
      qb.andWhere('k.movementType = :movementType', { movementType: query.movementType });
    }
    if (query.from) {
      qb.andWhere('k.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('k.createdAt <= :to', { to: new Date(query.to) });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('k.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async createCount(
    dto: CreateInventoryCountDto,
    userId: string,
  ): Promise<InventoryCountWithItems> {
    if (dto.countType === 'cycle' && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException('Una toma cíclica requiere al menos un productId');
    }
    if (
      dto.countType === 'partial' &&
      !dto.categoryId &&
      !dto.locationId &&
      (!dto.productIds || dto.productIds.length === 0)
    ) {
      throw new BadRequestException('Una toma parcial requiere al menos un filtro (categoryId, locationId o productIds)');
    }

    const lotsQb = this.lotRepo
      .createQueryBuilder('lot')
      .where('lot.branchId = :branchId', { branchId: dto.branchId })
      .andWhere("lot.status IN ('available', 'quarantine')");

    if (dto.locationId) {
      lotsQb.andWhere('lot.locationId = :locationId', { locationId: dto.locationId });
    }

    let productIdFilter = dto.productIds;
    if (dto.countType !== 'full' && dto.categoryId) {
      const products = await this.productRepo.find({
        where: { categoryId: dto.categoryId },
        select: ['id'],
      });
      const categoryProductIds = products.map((p) => p.id);
      productIdFilter = productIdFilter
        ? productIdFilter.filter((id) => categoryProductIds.includes(id))
        : categoryProductIds;
      if (productIdFilter.length === 0) {
        throw new BadRequestException('No hay productos en la categoría para contar');
      }
    }

    if (productIdFilter && productIdFilter.length > 0) {
      lotsQb.andWhere('lot.productId IN (:...productIds)', { productIds: productIdFilter });
    }

    const lots = await lotsQb.getMany();
    if (lots.length === 0) {
      throw new BadRequestException('No se encontraron lotes para generar la toma');
    }

    const countNumber = await this.generateCountNumber();

    return this.dataSource.transaction(async (manager) => {
      const count = manager.create(InventoryCountEntity, {
        branchId: dto.branchId,
        countNumber,
        countType: dto.countType,
        status: 'draft',
        countDate: new Date(),
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const savedCount = await manager.save(count);

      const items = lots.map((lot) =>
        manager.create(InventoryCountItemEntity, {
          countId: savedCount.id,
          productId: lot.productId,
          lotId: lot.id,
          systemQuantity: Number(lot.quantityAvailable),
          countedQuantity: null,
          difference: null,
        }),
      );
      const savedItems = await manager.save(items);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: savedCount.id,
        action: 'INSERT',
        newValues: { ...savedCount, itemCount: savedItems.length },
        userId,
      });

      return Object.assign(savedCount, { items: savedItems });
    });
  }

  async findAllCounts(
    query: QueryInventoryCountDto,
  ): Promise<{ data: InventoryCountEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.countRepo.createQueryBuilder('c');
    if (query.branchId) qb.andWhere('c.branchId = :branchId', { branchId: query.branchId });
    if (query.countType) qb.andWhere('c.countType = :countType', { countType: query.countType });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneCount(id: string): Promise<InventoryCountWithItems> {
    const count = await this.countRepo.findOne({ where: { id } });
    if (!count) throw new NotFoundException('Toma de inventario no encontrada');
    const items = await this.countItemRepo.find({ where: { countId: id } });
    return Object.assign(count, { items });
  }

  async updateCountItem(
    countId: string,
    itemId: string,
    dto: CountItemUpdateDto,
    userId: string,
  ): Promise<InventoryCountItemEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['draft', 'in_progress'].includes(count.status)) {
      throw new BadRequestException(`No se pueden modificar items en estado '${count.status}'`);
    }

    const item = await this.countItemRepo.findOne({ where: { id: itemId, countId } });
    if (!item) throw new NotFoundException('Item de toma no encontrado');

    item.countedQuantity = dto.countedQuantity;
    item.difference = Number((dto.countedQuantity - Number(item.systemQuantity)).toFixed(3));
    item.countedBy = userId;
    item.countedAt = new Date();
    const saved = await this.countItemRepo.save(item);

    if (count.status === 'draft') {
      count.status = 'in_progress';
      await this.countRepo.save(count);
    }

    return saved;
  }

  async bulkUpdateCountItems(
    countId: string,
    dto: BulkUpdateCountItemsDto,
    userId: string,
  ): Promise<InventoryCountItemEntity[]> {
    const results: InventoryCountItemEntity[] = [];
    for (const entry of dto.items) {
      results.push(await this.updateCountItem(countId, entry.itemId, { countedQuantity: entry.countedQuantity }, userId));
    }
    return results;
  }

  async completeCount(countId: string, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['draft', 'in_progress'].includes(count.status)) {
      throw new BadRequestException(`No se puede completar una toma en estado '${count.status}'`);
    }

    const pending = await this.countItemRepo.count({ where: { countId, countedQuantity: IsNull() } });
    if (pending > 0) {
      throw new BadRequestException(`Aún faltan ${pending} items por contar`);
    }

    count.status = 'completed';
    const saved = await this.countRepo.save(count);

    await this.auditService.log({
      tableName: 'inventory_counts',
      recordId: count.id,
      action: 'UPDATE',
      newValues: { status: 'completed' },
      userId,
    });

    return saved;
  }

  async approveCount(countId: string, dto: ApproveCountDto, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (count.status !== 'completed') {
      throw new BadRequestException('Solo se pueden aprobar tomas en estado completed');
    }

    const items = await this.countItemRepo.find({ where: { countId } });

    return this.dataSource.transaction(async (manager) => {
      for (const item of items) {
        const diff = Number(item.difference ?? 0);
        if (diff === 0 || !item.lotId) continue;

        const lot = await manager.findOne(InventoryLotEntity, { where: { id: item.lotId } });
        if (!lot) continue;

        const newAvailable = Number(lot.quantityAvailable) + diff;
        if (newAvailable < 0) {
          throw new BadRequestException(`Lote ${lot.lotNumber}: ajuste resultaría en cantidad negativa`);
        }
        lot.quantityAvailable = newAvailable;
        await manager.save(lot);

        const balanceRow = await manager
          .createQueryBuilder(InventoryLotEntity, 'lot')
          .select('SUM(lot.quantityAvailable)', 'total')
          .where('lot.productId = :productId', { productId: item.productId })
          .andWhere('lot.branchId = :branchId', { branchId: count.branchId })
          .getRawOne();

        const kardex = manager.create(KardexEntity, {
          productId: item.productId,
          branchId: count.branchId,
          lotId: item.lotId,
          movementType: diff > 0 ? 'adjustment_in' : 'adjustment_out',
          quantity: diff,
          balanceAfter: parseFloat(balanceRow?.total) || 0,
          referenceType: 'inventory_count',
          referenceId: count.id,
          notes: `Ajuste por toma ${count.countNumber} (${count.countType}): ${dto.justification}`,
          userId,
        });
        await manager.save(kardex);
      }

      count.status = 'approved';
      count.approvedBy = userId;
      count.approvedAt = new Date();
      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'approved', approvedBy: userId },
        justification: dto.justification,
        userId,
      });

      return saved;
    });
  }

  async cancelCount(countId: string, dto: CancelCountDto, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (['approved', 'cancelled'].includes(count.status)) {
      throw new BadRequestException(`No se puede cancelar una toma en estado '${count.status}'`);
    }

    count.status = 'cancelled';
    const saved = await this.countRepo.save(count);

    await this.auditService.log({
      tableName: 'inventory_counts',
      recordId: count.id,
      action: 'UPDATE',
      newValues: { status: 'cancelled' },
      justification: dto.reason,
      userId,
    });

    return saved;
  }

  private async generateCountNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `IC-${year}-`;
    const last = await this.countRepo
      .createQueryBuilder('c')
      .where('c.countNumber LIKE :prefix', { prefix: `${prefix}%` })
      .orderBy('c.countNumber', 'DESC')
      .getOne();
    const nextSeq = last ? parseInt(last.countNumber.slice(prefix.length), 10) + 1 : 1;
    return `${prefix}${String(nextSeq).padStart(5, '0')}`;
  }

  private addExpirySignal(lot: InventoryLotEntity): ExpirySignalLot {
    const today = new Date();
    const expDate = new Date(lot.expirationDate);
    const diffDays = Math.ceil((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    let expirySignal: 'EXPIRED' | 'RED' | 'YELLOW' | 'ORANGE' | 'GREEN';
    if (diffDays <= 0) {
      expirySignal = 'EXPIRED';
    } else if (diffDays <= 30) {
      expirySignal = 'RED';
    } else if (diffDays <= 60) {
      expirySignal = 'YELLOW';
    } else if (diffDays <= 90) {
      expirySignal = 'ORANGE';
    } else {
      expirySignal = 'GREEN';
    }

    return { ...lot, expirySignal };
  }

  private async createKardexEntry(data: {
    productId: string;
    branchId: string;
    lotId?: string;
    movementType: string;
    quantity: number;
    unitCostUsd?: number;
    referenceType?: string;
    referenceId?: string;
    notes?: string;
    userId: string;
    terminalId?: string;
  }): Promise<KardexEntity> {
    const currentStock = await this.lotRepo
      .createQueryBuilder('lot')
      .select('SUM(lot.quantityAvailable)', 'total')
      .where('lot.productId = :productId', { productId: data.productId })
      .andWhere('lot.branchId = :branchId', { branchId: data.branchId })
      .getRawOne();

    const balanceAfter = (parseFloat(currentStock?.total) || 0) + data.quantity;

    const kardex = this.kardexRepo.create({
      ...data,
      lotId: data.lotId || null,
      balanceAfter,
    });

    return this.kardexRepo.save(kardex);
  }
}
