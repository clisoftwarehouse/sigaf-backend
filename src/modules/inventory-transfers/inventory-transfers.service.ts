import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { KardexEntity } from '../inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { GoodsReceiptEntity } from '../purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';
import { GoodsReceiptItemEntity } from '../purchases/infrastructure/persistence/relational/entities/goods-receipt-item.entity';
import { WarehouseLocationEntity } from '../inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';
import { InventoryTransferEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer.entity';
import { InventoryTransferItemEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer-item.entity';
import {
  CancelTransferDto,
  CreateTransferDto,
  QueryTransfersDto,
  ReceiveTransferDto,
  TransferItemInputDto,
  CreateFromReceiptDto,
} from './dto';

/**
 * Gestiona traslados de stock. Soporta dos modalidades:
 *
 *  - inter_branch (default):
 *      draft  ──(dispatch)──▶  in_transit  ──(receive)──▶  completed
 *        │                           │
 *        └──(cancel)──▶ cancelled ◀──┘  (revierte stock al origen si estaba in_transit)
 *
 *  - intra_branch (mismo branch, distinto almacén):
 *      [crear]  ──instantáneo──▶  completed
 *      Solo actualiza `location_id` del lote (no parte cantidad). Kardex
 *      `warehouse_transfer` por cada lote movido.
 *
 * Cada movimiento genera asientos inmutables en `kardex` con
 * `referenceType='transfer'` y `referenceId=transfer.id`.
 */
@Injectable()
export class InventoryTransfersService {
  constructor(
    @InjectRepository(InventoryTransferEntity)
    private readonly transferRepo: Repository<InventoryTransferEntity>,
    @InjectRepository(InventoryTransferItemEntity)
    private readonly itemRepo: Repository<InventoryTransferItemEntity>,
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
    @InjectRepository(WarehouseLocationEntity)
    private readonly warehouseRepo: Repository<WarehouseLocationEntity>,
    @InjectRepository(GoodsReceiptEntity)
    private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptItemEntity)
    private readonly receiptItemRepo: Repository<GoodsReceiptItemEntity>,
    private readonly dataSource: DataSource,
  ) {}

  private generateTransferNumber(): string {
    const d = new Date();
    const yyyymmdd =
      d.getUTCFullYear().toString() +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      String(d.getUTCDate()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, '0');
    return `TRF-${yyyymmdd}-${rand}`;
  }

  /**
   * Crea un traslado. Si es `intra_branch`, se completa atómicamente en la misma
   * transacción (actualiza location_id de los lotes + kardex). Si es `inter_branch`,
   * queda en estado `draft` esperando dispatch.
   */
  async create(dto: CreateTransferDto, userId: string): Promise<InventoryTransferEntity> {
    const transferType = dto.transferType ?? 'inter_branch';

    if (transferType === 'intra_branch') {
      if (dto.fromBranchId !== dto.toBranchId) {
        throw new BadRequestException('intra_branch: la sucursal origen y destino deben ser la misma');
      }
      if (!dto.fromLocationId || !dto.toLocationId) {
        throw new BadRequestException('intra_branch: fromLocationId y toLocationId son obligatorios');
      }
      if (dto.fromLocationId === dto.toLocationId) {
        throw new BadRequestException('intra_branch: el almacén origen y destino deben ser distintos');
      }
      await this.validateWarehouse(dto.fromLocationId, dto.fromBranchId);
      await this.validateWarehouse(dto.toLocationId, dto.toBranchId);
    } else {
      if (dto.fromBranchId === dto.toBranchId) {
        throw new BadRequestException('inter_branch: la sucursal origen y destino deben ser distintas');
      }
    }

    for (const item of dto.items) {
      const lot = await this.lotRepo.findOne({ where: { id: item.lotId } });
      if (!lot) throw new NotFoundException(`Lote ${item.lotId} no encontrado`);
      if (lot.branchId !== dto.fromBranchId) {
        throw new BadRequestException(`Lote ${lot.lotNumber} no pertenece a la sucursal origen`);
      }
      if (lot.productId !== item.productId) {
        throw new BadRequestException(
          `Lote ${lot.lotNumber} (producto ${lot.productId}) no coincide con productId ${item.productId} del item`,
        );
      }
      if (lot.status !== 'available') {
        throw new BadRequestException(`Lote ${lot.lotNumber} no está disponible (status=${lot.status})`);
      }
      if (Number(lot.quantityAvailable) < item.quantitySent) {
        throw new BadRequestException(
          `Lote ${lot.lotNumber}: stock insuficiente (disponible ${lot.quantityAvailable}, solicitado ${item.quantitySent})`,
        );
      }
      if (transferType === 'intra_branch' && lot.locationId && lot.locationId !== dto.fromLocationId) {
        throw new BadRequestException(
          `Lote ${lot.lotNumber} ya está en otro almacén (${lot.locationId}), no en el origen indicado`,
        );
      }
    }

    return this.dataSource.transaction(async (manager) => {
      const initialStatus = transferType === 'intra_branch' ? 'completed' : 'draft';
      const transfer = manager.getRepository(InventoryTransferEntity).create({
        transferNumber: this.generateTransferNumber(),
        transferType,
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        fromLocationId: dto.fromLocationId ?? null,
        toLocationId: dto.toLocationId ?? null,
        sourceReceiptId: dto.sourceReceiptId ?? null,
        status: initialStatus,
        transferDate: dto.transferDate ? new Date(dto.transferDate) : new Date(),
        notes: dto.notes ?? null,
        createdBy: userId,
        sentBy: transferType === 'intra_branch' ? userId : null,
        sentAt: transferType === 'intra_branch' ? new Date() : null,
        receivedBy: transferType === 'intra_branch' ? userId : null,
        receivedAt: transferType === 'intra_branch' ? new Date() : null,
      });
      const saved = await manager.save(transfer);

      const items = dto.items.map((i) =>
        manager.getRepository(InventoryTransferItemEntity).create({
          transferId: saved.id,
          productId: i.productId,
          lotId: i.lotId,
          quantitySent: i.quantitySent,
          quantityReceived: transferType === 'intra_branch' ? i.quantitySent : null,
        }),
      );
      await manager.save(items);

      if (transferType === 'intra_branch') {
        await this.executeIntraBranchMove(manager, saved, items, userId);
      }

      return manager.getRepository(InventoryTransferEntity).findOneOrFail({
        where: { id: saved.id },
        relations: ['items'],
      });
    });
  }

  /**
   * Clona los items de un goods_receipt en una nueva transferencia.
   * Caso de uso central: "acabo de recepcionar, mando todo a góndola".
   */
  async createFromReceipt(
    receiptId: string,
    dto: CreateFromReceiptDto,
    userId: string,
  ): Promise<InventoryTransferEntity> {
    const receipt = await this.receiptRepo.findOne({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    if (receipt.requiresReapproval) {
      throw new BadRequestException('Recepción pendiente de reaprobación; los lotes aún no existen para transferir');
    }

    const receiptItems = await this.receiptItemRepo.find({ where: { receiptId } });
    const itemsWithLot = receiptItems.filter((ri) => ri.lotId);
    if (itemsWithLot.length === 0) {
      throw new BadRequestException('La recepción no tiene lotes asociados (¿no se completó?)');
    }

    const items: TransferItemInputDto[] = [];
    for (const ri of itemsWithLot) {
      const lot = await this.lotRepo.findOne({ where: { id: ri.lotId as string } });
      if (!lot) continue;
      if (Number(lot.quantityAvailable) <= 0) continue;
      items.push({
        productId: ri.productId,
        lotId: lot.id,
        quantitySent: Number(lot.quantityAvailable),
      });
    }

    if (items.length === 0) {
      throw new BadRequestException('No hay lotes con stock disponible para transferir desde esta recepción');
    }

    const toBranchId = dto.transferType === 'intra_branch' ? receipt.branchId : (dto.toBranchId ?? receipt.branchId);

    const createDto: CreateTransferDto = {
      transferType: dto.transferType,
      fromBranchId: receipt.branchId,
      toBranchId,
      fromLocationId: dto.fromLocationId,
      toLocationId: dto.toLocationId,
      sourceReceiptId: receipt.id,
      notes: dto.notes ?? `Generado desde recepción ${receipt.receiptNumber}`,
      items,
    };

    return this.create(createDto, userId);
  }

  /**
   * Ejecuta el movimiento intra-branch: actualiza `location_id` de cada lote
   * sin partir cantidades. Genera un evento de kardex `warehouse_transfer` por
   * lote para preservar el trazado del movimiento.
   */
  private async executeIntraBranchMove(
    manager: EntityManager,
    transfer: InventoryTransferEntity,
    items: InventoryTransferItemEntity[],
    userId: string,
  ): Promise<void> {
    for (const item of items) {
      const lot = await manager
        .getRepository(InventoryLotEntity)
        .createQueryBuilder('lot')
        .setLock('pessimistic_write')
        .where('lot.id = :id', { id: item.lotId })
        .getOne();
      if (!lot) throw new NotFoundException(`Lote ${item.lotId} no encontrado`);

      lot.locationId = transfer.toLocationId;
      await manager.save(lot);

      const balance = await this.balanceAfter(manager, lot.productId, lot.branchId);
      const kardex = manager.getRepository(KardexEntity).create({
        productId: lot.productId,
        branchId: lot.branchId,
        lotId: lot.id,
        movementType: 'warehouse_transfer',
        quantity: 0,
        unitCostUsd: Number(lot.costUsd),
        balanceAfter: balance,
        referenceType: 'transfer',
        referenceId: transfer.id,
        notes: `Traslado ${transfer.transferNumber}: almacén ${transfer.fromLocationId} → ${transfer.toLocationId}`,
        userId,
      });
      await manager.save(kardex);
    }
  }

  private async validateWarehouse(warehouseId: string | undefined, branchId: string): Promise<void> {
    if (!warehouseId) return;
    const wh = await this.warehouseRepo.findOne({ where: { id: warehouseId } });
    if (!wh) throw new NotFoundException(`Almacén ${warehouseId} no encontrado`);
    if (!wh.isActive) throw new BadRequestException(`Almacén ${wh.locationCode} está inactivo`);
    if (wh.branchId !== branchId) {
      throw new BadRequestException(`Almacén ${wh.locationCode} no pertenece a la sucursal indicada`);
    }
  }

  async findAll(
    query: QueryTransfersDto,
  ): Promise<{ data: InventoryTransferEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.transferRepo.createQueryBuilder('t');

    if (query.transferType) qb.andWhere('t.transferType = :tt', { tt: query.transferType });
    if (query.fromBranchId) qb.andWhere('t.fromBranchId = :from', { from: query.fromBranchId });
    if (query.toBranchId) qb.andWhere('t.toBranchId = :to', { to: query.toBranchId });
    if (query.fromLocationId) qb.andWhere('t.fromLocationId = :fromLoc', { fromLoc: query.fromLocationId });
    if (query.toLocationId) qb.andWhere('t.toLocationId = :toLoc', { toLoc: query.toLocationId });
    if (query.status) qb.andWhere('t.status = :status', { status: query.status });
    if (query.from) qb.andWhere('t.transferDate >= :dFrom', { dFrom: query.from });
    if (query.to) qb.andWhere('t.transferDate <= :dTo', { dTo: query.to });

    const [data, total] = await qb
      .orderBy('t.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<InventoryTransferEntity> {
    const transfer = await this.transferRepo.findOne({ where: { id }, relations: ['items'] });
    if (!transfer) throw new NotFoundException('Traslado no encontrado');
    return transfer;
  }

  async addItem(transferId: string, dto: TransferItemInputDto): Promise<InventoryTransferItemEntity> {
    const transfer = await this.findOne(transferId);
    if (transfer.transferType === 'intra_branch') {
      throw new BadRequestException('No se pueden agregar items a un traslado intra_branch (ya está completado)');
    }
    if (transfer.status !== 'draft') {
      throw new BadRequestException(`Solo se pueden agregar items en estado draft (actual: ${transfer.status})`);
    }

    const lot = await this.lotRepo.findOne({ where: { id: dto.lotId } });
    if (!lot) throw new NotFoundException('Lote no encontrado');
    if (lot.branchId !== transfer.fromBranchId) {
      throw new BadRequestException('El lote no pertenece a la sucursal origen del traslado');
    }
    if (lot.productId !== dto.productId) {
      throw new BadRequestException('El productId del item no coincide con el lote');
    }
    if (Number(lot.quantityAvailable) < dto.quantitySent) {
      throw new BadRequestException('Stock insuficiente en el lote origen');
    }

    const item = this.itemRepo.create({
      transferId,
      productId: dto.productId,
      lotId: dto.lotId,
      quantitySent: dto.quantitySent,
      quantityReceived: null,
    });
    return this.itemRepo.save(item);
  }

  async removeItem(transferId: string, itemId: string): Promise<void> {
    const transfer = await this.findOne(transferId);
    if (transfer.transferType === 'intra_branch') {
      throw new BadRequestException('No se pueden quitar items de un traslado intra_branch (ya está completado)');
    }
    if (transfer.status !== 'draft') {
      throw new BadRequestException(`Solo se pueden quitar items en estado draft (actual: ${transfer.status})`);
    }
    const res = await this.itemRepo.delete({ id: itemId, transferId });
    if (res.affected === 0) throw new NotFoundException('Item no encontrado en este traslado');
  }

  private async balanceAfter(manager: EntityManager, productId: string, branchId: string): Promise<number> {
    const row = await manager
      .createQueryBuilder(InventoryLotEntity, 'l')
      .select('COALESCE(SUM(l.quantityAvailable), 0)', 'total')
      .where('l.productId = :productId', { productId })
      .andWhere('l.branchId = :branchId', { branchId })
      .getRawOne<{ total: string }>();
    return Number(row?.total ?? 0);
  }

  /**
   * Draft → in_transit (solo aplica a inter_branch). Descuenta stock del origen
   * por cada item y registra kardex `transfer_out`. Transaccional con
   * pessimistic_write sobre cada lote para evitar races con ventas concurrentes.
   */
  async dispatch(id: string, userId: string): Promise<InventoryTransferEntity> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(InventoryTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) throw new NotFoundException('Traslado no encontrado');
      if (transfer.transferType === 'intra_branch') {
        throw new BadRequestException('Los traslados intra_branch ya están completados al crearse');
      }
      if (transfer.status !== 'draft') {
        throw new BadRequestException(`Solo se puede despachar desde draft (actual: ${transfer.status})`);
      }

      const items = await manager.getRepository(InventoryTransferItemEntity).find({ where: { transferId: id } });
      if (items.length === 0) throw new BadRequestException('El traslado no tiene items');

      for (const item of items) {
        const lot = await manager
          .getRepository(InventoryLotEntity)
          .createQueryBuilder('lot')
          .setLock('pessimistic_write')
          .where('lot.id = :id', { id: item.lotId })
          .getOne();

        if (!lot) throw new NotFoundException(`Lote ${item.lotId} no encontrado`);
        if (lot.branchId !== transfer.fromBranchId) {
          throw new BadRequestException(`Lote ${lot.lotNumber} no pertenece al origen`);
        }
        if (lot.status !== 'available') {
          throw new BadRequestException(`Lote ${lot.lotNumber} no disponible (status=${lot.status})`);
        }
        if (new Date(lot.expirationDate).getTime() <= Date.now()) {
          throw new BadRequestException(`Lote ${lot.lotNumber} está vencido`);
        }
        const available = Number(lot.quantityAvailable);
        if (available < Number(item.quantitySent)) {
          throw new BadRequestException(
            `Lote ${lot.lotNumber}: stock insuficiente (disponible ${available}, requerido ${item.quantitySent})`,
          );
        }

        lot.quantityAvailable = +(available - Number(item.quantitySent)).toFixed(3);
        await manager.save(lot);

        const balance = await this.balanceAfter(manager, lot.productId, lot.branchId);
        const kardex = manager.getRepository(KardexEntity).create({
          productId: lot.productId,
          branchId: lot.branchId,
          lotId: lot.id,
          movementType: 'transfer_out',
          quantity: -Number(item.quantitySent),
          unitCostUsd: Number(lot.costUsd),
          balanceAfter: balance,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `Despacho traslado ${transfer.transferNumber} → sucursal destino`,
          userId,
        });
        await manager.save(kardex);
      }

      transfer.status = 'in_transit';
      transfer.sentBy = userId;
      transfer.sentAt = new Date();
      await manager.save(transfer);

      return manager.getRepository(InventoryTransferEntity).findOneOrFail({
        where: { id },
        relations: ['items'],
      });
    });
  }

  /**
   * In_transit → completed (solo aplica a inter_branch). Por cada item:
   *   1. Setea `quantityReceived`.
   *   2. Busca/crea lote en destino con mismo `lot_number` (reusa metadatos del origen).
   *   3. Incrementa `quantityAvailable` en destino con la cantidad recibida.
   *   4. Registra kardex `transfer_in`.
   *
   * Si `quantityReceived < quantitySent`, la diferencia queda como merma en tránsito
   * (ya descontada del origen en dispatch; no llega al destino). No genera kardex extra.
   */
  async receive(id: string, dto: ReceiveTransferDto, userId: string): Promise<InventoryTransferEntity> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(InventoryTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) throw new NotFoundException('Traslado no encontrado');
      if (transfer.transferType === 'intra_branch') {
        throw new BadRequestException('Los traslados intra_branch ya están completados al crearse');
      }
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(`Solo se puede recibir desde in_transit (actual: ${transfer.status})`);
      }

      const items = await manager.getRepository(InventoryTransferItemEntity).find({ where: { transferId: id } });
      const itemsById = new Map(items.map((i) => [i.id, i]));

      for (const r of dto.items) {
        if (!itemsById.has(r.itemId)) {
          throw new BadRequestException(`Item ${r.itemId} no pertenece al traslado`);
        }
        const original = itemsById.get(r.itemId)!;
        if (r.quantityReceived > Number(original.quantitySent)) {
          throw new BadRequestException(
            `No se puede recibir ${r.quantityReceived} del item ${r.itemId}: excede lo enviado (${original.quantitySent})`,
          );
        }
      }

      for (const r of dto.items) {
        const item = itemsById.get(r.itemId)!;
        item.quantityReceived = r.quantityReceived;
        await manager.save(item);

        if (r.quantityReceived <= 0) continue;

        const originLot = await manager.getRepository(InventoryLotEntity).findOneOrFail({ where: { id: item.lotId } });

        let destLot = await manager.getRepository(InventoryLotEntity).findOne({
          where: {
            productId: originLot.productId,
            branchId: transfer.toBranchId,
            lotNumber: originLot.lotNumber,
          },
        });

        if (destLot) {
          destLot.quantityAvailable = +(Number(destLot.quantityAvailable) + r.quantityReceived).toFixed(3);
          destLot.quantityReceived = +(Number(destLot.quantityReceived) + r.quantityReceived).toFixed(3);
          await manager.save(destLot);
        } else {
          destLot = manager.getRepository(InventoryLotEntity).create({
            productId: originLot.productId,
            branchId: transfer.toBranchId,
            lotNumber: originLot.lotNumber,
            expirationDate: originLot.expirationDate,
            manufactureDate: originLot.manufactureDate,
            acquisitionType: 'transfer',
            supplierId: originLot.supplierId,
            consignmentEntryId: originLot.consignmentEntryId,
            costUsd: originLot.costUsd,
            salePrice: originLot.salePrice,
            marginPct: originLot.marginPct,
            quantityReceived: r.quantityReceived,
            quantityAvailable: r.quantityReceived,
            quantityReserved: 0,
            quantitySold: 0,
            quantityDamaged: 0,
            quantityReturned: 0,
            locationId: transfer.toLocationId,
            status: 'available',
          });
          destLot = await manager.save(destLot);
        }

        const balance = await this.balanceAfter(manager, destLot.productId, destLot.branchId);
        const kardex = manager.getRepository(KardexEntity).create({
          productId: destLot.productId,
          branchId: destLot.branchId,
          lotId: destLot.id,
          movementType: 'transfer_in',
          quantity: r.quantityReceived,
          unitCostUsd: Number(originLot.costUsd),
          balanceAfter: balance,
          referenceType: 'transfer',
          referenceId: transfer.id,
          notes: `Recepción traslado ${transfer.transferNumber} desde sucursal origen`,
          userId,
        });
        await manager.save(kardex);
      }

      transfer.status = 'completed';
      transfer.receivedBy = userId;
      transfer.receivedAt = new Date();
      if (dto.notes) transfer.notes = transfer.notes ? `${transfer.notes}\n${dto.notes}` : dto.notes;
      await manager.save(transfer);

      return manager.getRepository(InventoryTransferEntity).findOneOrFail({
        where: { id },
        relations: ['items'],
      });
    });
  }

  /**
   * Cancela un traslado inter_branch. Si estaba in_transit, devuelve el stock
   * al lote origen y registra kardex `transfer_cancelled`. Los traslados
   * intra_branch no se pueden cancelar (son instantáneos; crear inverso si hace falta).
   */
  async cancel(id: string, dto: CancelTransferDto, userId: string): Promise<InventoryTransferEntity> {
    return this.dataSource.transaction(async (manager) => {
      const transfer = await manager
        .getRepository(InventoryTransferEntity)
        .createQueryBuilder('t')
        .setLock('pessimistic_write')
        .where('t.id = :id', { id })
        .getOne();

      if (!transfer) throw new NotFoundException('Traslado no encontrado');
      if (transfer.transferType === 'intra_branch') {
        throw new BadRequestException(
          'Los traslados intra_branch no se cancelan: crea un traslado inverso para devolver al almacén original',
        );
      }
      if (transfer.status === 'completed') {
        throw new BadRequestException('No se puede cancelar un traslado ya completado — crea un traslado inverso');
      }
      if (transfer.status === 'cancelled') {
        throw new BadRequestException('El traslado ya está cancelado');
      }

      if (transfer.status === 'in_transit') {
        const items = await manager.getRepository(InventoryTransferItemEntity).find({ where: { transferId: id } });
        for (const item of items) {
          const lot = await manager
            .getRepository(InventoryLotEntity)
            .createQueryBuilder('lot')
            .setLock('pessimistic_write')
            .where('lot.id = :id', { id: item.lotId })
            .getOne();
          if (!lot) continue;

          lot.quantityAvailable = +(Number(lot.quantityAvailable) + Number(item.quantitySent)).toFixed(3);
          await manager.save(lot);

          const balance = await this.balanceAfter(manager, lot.productId, lot.branchId);
          const kardex = manager.getRepository(KardexEntity).create({
            productId: lot.productId,
            branchId: lot.branchId,
            lotId: lot.id,
            movementType: 'transfer_cancelled',
            quantity: Number(item.quantitySent),
            unitCostUsd: Number(lot.costUsd),
            balanceAfter: balance,
            referenceType: 'transfer',
            referenceId: transfer.id,
            notes: `Cancelación traslado ${transfer.transferNumber}${dto.reason ? ` — ${dto.reason}` : ''}`,
            userId,
          });
          await manager.save(kardex);
        }
      }

      transfer.status = 'cancelled';
      if (dto.reason) {
        transfer.notes = transfer.notes ? `${transfer.notes}\n[CANCEL] ${dto.reason}` : `[CANCEL] ${dto.reason}`;
      }
      await manager.save(transfer);

      return manager.getRepository(InventoryTransferEntity).findOneOrFail({
        where: { id },
        relations: ['items'],
      });
    });
  }
}
