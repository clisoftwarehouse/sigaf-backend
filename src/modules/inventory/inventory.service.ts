import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, DataSource, Repository } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCountEntity } from './infrastructure/persistence/relational/entities/inventory-count.entity';
import { InventoryCountItemEntity } from './infrastructure/persistence/relational/entities/inventory-count-item.entity';
import { InventoryCyclicScheduleEntity } from './infrastructure/persistence/relational/entities/inventory-cyclic-schedule.entity';
import {
  QueryStockDto,
  QueryKardexDto,
  CancelCountDto,
  RecountItemDto,
  ApproveCountDto,
  QueryAccuracyDto,
  QuarantineLotDto,
  CountItemUpdateDto,
  CreateAdjustmentDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
  QueryInventoryCountDto,
  QueryCyclicScheduleDto,
  BulkUpdateCountItemsDto,
  CreateInventoryCountDto,
  CreateCyclicScheduleDto,
  UpdateCyclicScheduleDto,
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
    @InjectRepository(InventoryCyclicScheduleEntity)
    private readonly cyclicScheduleRepo: Repository<InventoryCyclicScheduleEntity>,
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

  async startCount(countId: string, userId: string): Promise<InventoryCountEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (count.status !== 'draft') {
      throw new BadRequestException(`No se puede iniciar una toma en estado '${count.status}'`);
    }

    return this.dataSource.transaction(async (manager) => {
      count.status = 'in_progress';
      count.startedAt = new Date();

      if (count.blocksSales) {
        const productIds = await manager
          .createQueryBuilder(InventoryCountItemEntity, 'item')
          .select('DISTINCT item.productId', 'productId')
          .where('item.countId = :countId', { countId })
          .getRawMany<{ productId: string }>();

        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: true })
            .whereInIds(productIds.map((p) => p.productId))
            .execute();
        }
        count.blockedAt = new Date();
      }

      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'in_progress', startedAt: count.startedAt, blockedAt: count.blockedAt },
        userId,
      });

      return saved;
    });
  }

  async recountCountItem(
    countId: string,
    itemId: string,
    dto: RecountItemDto,
    userId: string,
  ): Promise<InventoryCountItemEntity> {
    const count = await this.countRepo.findOne({ where: { id: countId } });
    if (!count) throw new NotFoundException('Toma no encontrada');
    if (!['in_progress', 'completed'].includes(count.status)) {
      throw new BadRequestException(`No se puede recontar en estado '${count.status}'`);
    }

    const item = await this.countItemRepo.findOne({ where: { id: itemId, countId } });
    if (!item) throw new NotFoundException('Item de toma no encontrado');

    item.countedQuantity = null;
    item.countedLotNumber = null;
    item.countedExpirationDate = null;
    item.difference = null;
    item.differenceType = null;
    item.countedBy = null;
    item.countedAt = null;
    item.isRecounted = true;
    item.recountReason = dto.recountReason;

    const saved = await this.countItemRepo.save(item);

    if (count.status === 'completed') {
      count.status = 'in_progress';
      await this.countRepo.save(count);
    }

    await this.auditService.log({
      tableName: 'inventory_count_items',
      recordId: itemId,
      action: 'UPDATE',
      newValues: { isRecounted: true },
      justification: dto.recountReason,
      userId,
    });

    return saved;
  }

  async findCyclicSchedules(query: QueryCyclicScheduleDto): Promise<InventoryCyclicScheduleEntity[]> {
    const qb = this.cyclicScheduleRepo.createQueryBuilder('s');
    if (query.branchId) qb.andWhere('s.branchId = :branchId', { branchId: query.branchId });
    if (query.isActive !== undefined) qb.andWhere('s.isActive = :isActive', { isActive: query.isActive });
    return qb.orderBy('s.createdAt', 'DESC').getMany();
  }

  async createCyclicSchedule(dto: CreateCyclicScheduleDto, userId: string): Promise<InventoryCyclicScheduleEntity> {
    const frequencyDays = dto.frequencyDays ?? 7;
    const schedule = this.cyclicScheduleRepo.create({
      branchId: dto.branchId,
      name: dto.name,
      abcClasses: dto.abcClasses,
      riskLevels: dto.riskLevels ?? null,
      frequencyDays,
      maxSkusPerCount: dto.maxSkusPerCount ?? 50,
      autoGenerate: dto.autoGenerate ?? true,
      isActive: dto.isActive ?? true,
      nextGenerationAt: this.addDays(new Date(), frequencyDays),
      createdBy: userId,
    });
    return this.cyclicScheduleRepo.save(schedule);
  }

  async updateCyclicSchedule(id: string, dto: UpdateCyclicScheduleDto): Promise<InventoryCyclicScheduleEntity> {
    const schedule = await this.cyclicScheduleRepo.findOne({ where: { id } });
    if (!schedule) throw new NotFoundException('Programa cíclico no encontrado');

    if (dto.branchId !== undefined) schedule.branchId = dto.branchId;
    if (dto.name !== undefined) schedule.name = dto.name;
    if (dto.abcClasses !== undefined) schedule.abcClasses = dto.abcClasses;
    if (dto.riskLevels !== undefined) schedule.riskLevels = dto.riskLevels;
    if (dto.frequencyDays !== undefined) schedule.frequencyDays = dto.frequencyDays;
    if (dto.maxSkusPerCount !== undefined) schedule.maxSkusPerCount = dto.maxSkusPerCount;
    if (dto.autoGenerate !== undefined) schedule.autoGenerate = dto.autoGenerate;
    if (dto.isActive !== undefined) schedule.isActive = dto.isActive;

    return this.cyclicScheduleRepo.save(schedule);
  }

  async getAccuracy(query: QueryAccuracyDto): Promise<{
    avgAccuracyPct: number;
    totalCounts: number;
    totalAdjustments: number;
    trend: Array<{ date: string; accuracyPct: number }>;
  }> {
    const qb = this.countRepo
      .createQueryBuilder('c')
      .where("c.status = 'approved'")
      .andWhere('c.accuracyPct IS NOT NULL');

    if (query.branchId) qb.andWhere('c.branchId = :branchId', { branchId: query.branchId });
    if (query.from) qb.andWhere('c.completedAt >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('c.completedAt <= :to', { to: new Date(query.to) });

    const counts = await qb.orderBy('c.completedAt', 'ASC').getMany();

    const totalCounts = counts.length;
    const avgAccuracyPct =
      totalCounts === 0
        ? 0
        : Number((counts.reduce((sum, c) => sum + Number(c.accuracyPct ?? 0), 0) / totalCounts).toFixed(2));

    const totalAdjustments = counts.reduce(
      (sum, c) => sum + Number(c.totalSkusOver ?? 0) + Number(c.totalSkusShort ?? 0),
      0,
    );

    const trend = counts.map((c) => ({
      date: (c.completedAt ?? c.createdAt).toISOString().slice(0, 10),
      accuracyPct: Number(c.accuracyPct ?? 0),
    }));

    return { avgAccuracyPct, totalCounts, totalAdjustments, trend };
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  async createCount(dto: CreateInventoryCountDto, userId: string): Promise<InventoryCountWithItems> {
    if (dto.countType === 'cycle' && (!dto.productIds || dto.productIds.length === 0)) {
      throw new BadRequestException('Una toma cíclica requiere al menos un productId');
    }
    if (
      dto.countType === 'partial' &&
      !dto.categoryId &&
      !dto.locationId &&
      (!dto.productIds || dto.productIds.length === 0)
    ) {
      throw new BadRequestException(
        'Una toma parcial requiere al menos un filtro (categoryId, locationId o productIds)',
      );
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
          locationId: lot.locationId ?? null,
          expectedQuantity: Number(lot.quantityAvailable),
          expectedLotNumber: lot.lotNumber,
          expectedExpirationDate: lot.expirationDate,
          systemQuantity: Number(lot.quantityAvailable),
          countedQuantity: null,
          difference: null,
        }),
      );
      const savedItems = await manager.save(items);

      savedCount.totalSkusExpected = savedItems.length;
      await manager.save(savedCount);

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
    const diff = Number((dto.countedQuantity - Number(item.systemQuantity)).toFixed(3));
    item.difference = diff;
    item.differenceType = diff === 0 ? 'match' : diff > 0 ? 'over' : 'short';
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
      results.push(
        await this.updateCountItem(countId, entry.itemId, { countedQuantity: entry.countedQuantity }, userId),
      );
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

    const items = await this.countItemRepo.find({ where: { countId } });
    const matched = items.filter((i) => i.differenceType === 'match').length;
    const over = items.filter((i) => i.differenceType === 'over').length;
    const short = items.filter((i) => i.differenceType === 'short').length;
    const counted = items.length;

    count.status = 'completed';
    count.completedAt = new Date();
    count.totalSkusCounted = counted;
    count.totalSkusMatched = matched;
    count.totalSkusOver = over;
    count.totalSkusShort = short;
    count.accuracyPct = counted === 0 ? 0 : Number(((matched / counted) * 100).toFixed(2));
    const saved = await this.countRepo.save(count);

    await this.auditService.log({
      tableName: 'inventory_counts',
      recordId: count.id,
      action: 'UPDATE',
      newValues: {
        status: 'completed',
        totalSkusMatched: matched,
        totalSkusOver: over,
        totalSkusShort: short,
        accuracyPct: count.accuracyPct,
      },
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

      if (count.blocksSales && count.blockedAt && !count.unblockedAt) {
        const productIds = items.map((i) => i.productId);
        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: false })
            .whereInIds(productIds)
            .execute();
        }
        count.unblockedAt = new Date();
      }

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

    return this.dataSource.transaction(async (manager) => {
      count.status = 'cancelled';

      if (count.blocksSales && count.blockedAt && !count.unblockedAt) {
        const items = await manager.find(InventoryCountItemEntity, { where: { countId } });
        const productIds = items.map((i) => i.productId);
        if (productIds.length > 0) {
          await manager
            .createQueryBuilder()
            .update(ProductEntity)
            .set({ inventoryBlocked: false })
            .whereInIds(productIds)
            .execute();
        }
        count.unblockedAt = new Date();
      }

      const saved = await manager.save(count);

      await this.auditService.log({
        tableName: 'inventory_counts',
        recordId: count.id,
        action: 'UPDATE',
        newValues: { status: 'cancelled' },
        justification: dto.reason,
        userId,
      });

      return saved;
    });
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
