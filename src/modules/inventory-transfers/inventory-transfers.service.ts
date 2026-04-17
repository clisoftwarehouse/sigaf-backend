import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { KardexEntity } from '../inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { InventoryLotEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryTransferEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer.entity';
import {
  CancelTransferDto,
  CreateTransferDto,
  QueryTransfersDto,
  ReceiveTransferDto,
  TransferItemInputDto,
} from './dto';
import { InventoryTransferItemEntity } from '../inventory/infrastructure/persistence/relational/entities/inventory-transfer-item.entity';

/**
 * Gestiona traslados de stock entre sucursales. Flujo:
 *
 *   draft  ──(dispatch)──▶  in_transit  ──(receive)──▶  completed
 *     │                           │
 *     └──(cancel)──▶ cancelled ◀──┘  (revierte stock al origen si estaba in_transit)
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

  async create(dto: CreateTransferDto, userId: string): Promise<InventoryTransferEntity> {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('La sucursal origen y destino deben ser distintas');
    }

    // Validación temprana: verificar que cada lote pertenece al origen y tiene stock suficiente.
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
    }

    return this.dataSource.transaction(async (manager) => {
      const transfer = manager.getRepository(InventoryTransferEntity).create({
        transferNumber: this.generateTransferNumber(),
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        status: 'draft',
        transferDate: dto.transferDate ? new Date(dto.transferDate) : new Date(),
        notes: dto.notes ?? null,
        createdBy: userId,
      });
      const saved = await manager.save(transfer);

      const items = dto.items.map((i) =>
        manager.getRepository(InventoryTransferItemEntity).create({
          transferId: saved.id,
          productId: i.productId,
          lotId: i.lotId,
          quantitySent: i.quantitySent,
          quantityReceived: null,
        }),
      );
      await manager.save(items);

      return manager.getRepository(InventoryTransferEntity).findOneOrFail({
        where: { id: saved.id },
        relations: ['items'],
      });
    });
  }

  async findAll(
    query: QueryTransfersDto,
  ): Promise<{ data: InventoryTransferEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.transferRepo.createQueryBuilder('t');

    if (query.fromBranchId) qb.andWhere('t.fromBranchId = :from', { from: query.fromBranchId });
    if (query.toBranchId) qb.andWhere('t.toBranchId = :to', { to: query.toBranchId });
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
   * Draft → in_transit. Descuenta stock del origen por cada item y
   * registra kardex `transfer_out`. Transaccional con pessimistic_write
   * sobre cada lote para evitar races con ventas concurrentes.
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
   * In_transit → completed. Por cada item:
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
      if (transfer.status !== 'in_transit') {
        throw new BadRequestException(`Solo se puede recibir desde in_transit (actual: ${transfer.status})`);
      }

      const items = await manager.getRepository(InventoryTransferItemEntity).find({ where: { transferId: id } });
      const itemsById = new Map(items.map((i) => [i.id, i]));

      // Validar que todos los items del dto existen y pertenecen al traslado
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

        if (r.quantityReceived <= 0) continue; // Merma total — no entra al destino

        // Obtener lote origen (para metadatos que replicamos en el destino)
        const originLot = await manager.getRepository(InventoryLotEntity).findOneOrFail({ where: { id: item.lotId } });

        // Buscar o crear lote en destino con mismo lot_number
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
            locationId: null,
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
   * Cancela un traslado. Si estaba in_transit, devuelve el stock al lote origen
   * y registra kardex `transfer_cancelled`. Si estaba draft, solo marca cancelled.
   * No se puede cancelar un traslado `completed` (requiere crear un traslado inverso).
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
