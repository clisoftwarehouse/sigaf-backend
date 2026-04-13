import { DataSource, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { GoodsReceiptEntity } from './infrastructure/persistence/relational/entities/goods-receipt.entity';
import { PurchaseOrderEntity } from './infrastructure/persistence/relational/entities/purchase-order.entity';
import { GoodsReceiptItemEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item.entity';
import { CreateGoodsReceiptDto, QueryPurchaseOrderDto, CreatePurchaseOrderDto, UpdatePurchaseOrderDto } from './dto';
import { PurchaseOrderItemEntity } from './infrastructure/persistence/relational/entities/purchase-order-item.entity';

@Injectable()
export class PurchasesService {
  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private readonly orderItemRepo: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(GoodsReceiptEntity)
    private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptItemEntity)
    private readonly receiptItemRepo: Repository<GoodsReceiptItemEntity>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── PURCHASE ORDERS ──────────────────────────────────────────────────

  async findAllOrders(
    query: QueryPurchaseOrderDto,
  ): Promise<{ data: PurchaseOrderEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.orderRepo.createQueryBuilder('o');

    if (query.branchId) qb.andWhere('o.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) qb.andWhere('o.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });
    if (query.orderType) qb.andWhere('o.orderType = :orderType', { orderType: query.orderType });
    if (query.from) qb.andWhere('o.orderDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('o.orderDate <= :to', { to: query.to });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('o.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneOrder(id: string): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    const items = await this.orderItemRepo.find({ where: { orderId: id }, order: { createdAt: 'ASC' } });

    return { ...order, items };
  }

  async createOrder(dto: CreatePurchaseOrderDto, userId: string): Promise<PurchaseOrderEntity> {
    if (!dto.items.length) throw new BadRequestException('La orden debe tener al menos un ítem');

    const orderNumber = await this.generateOrderNumber();

    let subtotalUsd = 0;
    const itemsData = dto.items.map((item) => {
      const discount = item.discountPct || 0;
      const itemSubtotal = item.quantity * item.unitCostUsd * (1 - discount / 100);
      subtotalUsd += itemSubtotal;
      return { ...item, subtotalUsd: itemSubtotal, discountPct: discount };
    });

    const taxUsd = 0;
    const totalUsd = subtotalUsd + taxUsd;

    const order = this.orderRepo.create({
      branchId: dto.branchId,
      supplierId: dto.supplierId,
      orderNumber,
      orderType: dto.orderType || 'purchase',
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : null,
      notes: dto.notes || null,
      status: 'draft',
      subtotalUsd,
      taxUsd,
      totalUsd,
      createdBy: userId,
      generatedBy: 'manual',
    });

    const savedOrder = await this.orderRepo.save(order);

    const items = itemsData.map((item) =>
      this.orderItemRepo.create({
        orderId: savedOrder.id,
        productId: item.productId,
        quantity: item.quantity,
        unitCostUsd: item.unitCostUsd,
        discountPct: item.discountPct,
        subtotalUsd: item.subtotalUsd,
      }),
    );
    await this.orderItemRepo.save(items);

    return this.findOneOrder(savedOrder.id);
  }

  async updateOrder(id: string, dto: UpdatePurchaseOrderDto, userId: string): Promise<PurchaseOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    if (order.status === 'complete' || order.status === 'cancelled') {
      throw new BadRequestException('No se puede modificar una orden completada o cancelada');
    }

    const oldValues = { ...order };
    Object.assign(order, {
      ...dto,
      expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : order.expectedDate,
    });
    const updated = await this.orderRepo.save(order);

    await this.auditService.log({
      tableName: 'purchase_orders',
      recordId: id,
      action: 'UPDATE',
      oldValues,
      newValues: updated,
      userId,
    });

    return this.findOneOrder(id);
  }

  async approveOrder(id: string, userId: string): Promise<PurchaseOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    if (order.status !== 'draft') throw new BadRequestException('Solo se pueden aprobar órdenes en borrador');

    order.status = 'sent';
    order.approvedBy = userId;
    await this.orderRepo.save(order);

    await this.auditService.log({
      tableName: 'purchase_orders',
      recordId: id,
      action: 'UPDATE',
      newValues: { status: 'sent', approvedBy: userId },
      userId,
    });

    return this.findOneOrder(id);
  }

  // ─── GOODS RECEIPTS ───────────────────────────────────────────────────

  async findAllReceipts(query: {
    branchId?: string;
    supplierId?: string;
    purchaseOrderId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: GoodsReceiptEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.receiptRepo.createQueryBuilder('r');

    if (query.branchId) qb.andWhere('r.branchId = :branchId', { branchId: query.branchId });
    if (query.supplierId) qb.andWhere('r.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.purchaseOrderId) {
      qb.andWhere('r.purchaseOrderId = :purchaseOrderId', { purchaseOrderId: query.purchaseOrderId });
    }
    if (query.from) qb.andWhere('r.receiptDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('r.receiptDate <= :to', { to: query.to });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOneReceipt(id: string): Promise<any> {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');

    const items = await this.receiptItemRepo.find({ where: { receiptId: id }, order: { createdAt: 'ASC' } });

    return { ...receipt, items };
  }

  async createReceipt(dto: CreateGoodsReceiptDto, userId: string): Promise<GoodsReceiptEntity> {
    if (!dto.items.length) throw new BadRequestException('La recepción debe tener al menos un ítem');

    const receiptNumber = await this.generateReceiptNumber();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      let totalUsd = 0;
      for (const item of dto.items) {
        totalUsd += item.quantity * item.unitCostUsd;
      }

      const receipt = this.receiptRepo.create({
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        purchaseOrderId: dto.purchaseOrderId || null,
        receiptNumber,
        receiptType: dto.receiptType || 'purchase',
        supplierInvoiceNumber: dto.supplierInvoiceNumber || null,
        notes: dto.notes || null,
        totalUsd,
        receivedBy: userId,
      });

      const savedReceipt = await queryRunner.manager.save(receipt);

      for (const item of dto.items) {
        const lot = await this.inventoryService.createLot(
          {
            productId: item.productId,
            branchId: dto.branchId,
            lotNumber: item.lotNumber,
            expirationDate: item.expirationDate,
            quantityReceived: item.quantity,
            costUsd: item.unitCostUsd,
            salePrice: item.salePrice,
            acquisitionType: dto.receiptType === 'consignment' ? 'consignment' : 'purchase',
            supplierId: dto.supplierId,
          },
          userId,
        );

        const receiptItem = this.receiptItemRepo.create({
          receiptId: savedReceipt.id,
          productId: item.productId,
          lotId: lot.id,
          quantity: item.quantity,
          unitCostUsd: item.unitCostUsd,
          salePrice: item.salePrice,
          lotNumber: item.lotNumber,
          expirationDate: new Date(item.expirationDate),
        });
        await queryRunner.manager.save(receiptItem);
      }

      if (dto.purchaseOrderId) {
        await this.updateOrderStatusAfterReceipt(dto.purchaseOrderId);
      }

      await queryRunner.commitTransaction();

      return this.findOneReceipt(savedReceipt.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── HELPERS ───────────────────────────────────────────────────────────

  private async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.orderRepo
      .createQueryBuilder('o')
      .where('o.orderNumber LIKE :pattern', { pattern: `OC-${year}-%` })
      .getCount();
    return `OC-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async generateReceiptNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.receiptRepo
      .createQueryBuilder('r')
      .where('r.receiptNumber LIKE :pattern', { pattern: `RM-${year}-%` })
      .getCount();
    return `RM-${year}-${String(count + 1).padStart(6, '0')}`;
  }

  private async updateOrderStatusAfterReceipt(orderId: string): Promise<void> {
    const items = await this.orderItemRepo.find({ where: { orderId } });
    if (!items.length) return;

    const receiptItems = await this.receiptItemRepo
      .createQueryBuilder('ri')
      .innerJoin('goods_receipts', 'r', 'r.id = ri.receipt_id')
      .where('r.purchase_order_id = :orderId', { orderId })
      .getMany();

    const receivedByProduct: Record<string, number> = {};
    for (const ri of receiptItems) {
      receivedByProduct[ri.productId] = (receivedByProduct[ri.productId] || 0) + Number(ri.quantity);
    }

    let allComplete = true;
    let anyReceived = false;

    for (const item of items) {
      const received = receivedByProduct[item.productId] || 0;
      if (received > 0) anyReceived = true;
      if (received < Number(item.quantity)) allComplete = false;
    }

    if (allComplete) {
      await this.orderRepo.update(orderId, { status: 'complete' });
    } else if (anyReceived) {
      await this.orderRepo.update(orderId, { status: 'partial' });
    }
  }
}
