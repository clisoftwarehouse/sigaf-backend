import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { KardexEntity } from './infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import {
  QueryStockDto,
  QueryKardexDto,
  QuarantineLotDto,
  CreateAdjustmentDto,
  QueryInventoryLotDto,
  CreateInventoryLotDto,
  UpdateInventoryLotDto,
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

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
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
