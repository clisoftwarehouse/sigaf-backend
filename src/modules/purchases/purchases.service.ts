import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, Repository, EntityManager } from 'typeorm';
import {
  Logger,
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { ClaimsService } from '../claims/claims.service';
import { PricesService } from '../prices/prices.service';
import { InventoryService } from '../inventory/inventory.service';
import { ApprovalEngineService } from './approval-engine.service';
import { ExchangeRatesService } from '../exchange-rates/exchange-rates.service';
import { GoodsReceiptEntity } from './infrastructure/persistence/relational/entities/goods-receipt.entity';
import { PurchaseOrderEntity } from './infrastructure/persistence/relational/entities/purchase-order.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { GoodsReceiptItemEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { PurchaseOrderItemEntity } from './infrastructure/persistence/relational/entities/purchase-order-item.entity';
import { GlobalConfigEntity } from '@/modules/config-global/infrastructure/persistence/relational/entities/global-config.entity';
import { GoodsReceiptItemDiscrepancyEntity } from './infrastructure/persistence/relational/entities/goods-receipt-item-discrepancy.entity';
import {
  ReapproveReceiptDto,
  CreateGoodsReceiptDto,
  QueryPurchaseOrderDto,
  CreatePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto';

/**
 * Días que una OC en `draft` puede permanecer abierta antes de que el cron
 * diario la cancele automáticamente. Definido en PDF Política OC, Sección 6.
 * Si se necesita variar por contenedor, mover a GlobalConfig key.
 */
export const DRAFT_AUTO_CANCEL_DAYS = 30;

/**
 * Umbral para mostrar la etiqueta "vence en N días" en la UI.
 * Cualquier OC en draft con `daysUntilAutoCancel <= esta cifra` se considera
 * próxima a vencer.
 */
export const DRAFT_EXPIRY_WARNING_DAYS = 7;

@Injectable()
export class PurchasesService {
  private readonly logger = new Logger(PurchasesService.name);

  constructor(
    @InjectRepository(PurchaseOrderEntity)
    private readonly orderRepo: Repository<PurchaseOrderEntity>,
    @InjectRepository(PurchaseOrderItemEntity)
    private readonly orderItemRepo: Repository<PurchaseOrderItemEntity>,
    @InjectRepository(GoodsReceiptEntity)
    private readonly receiptRepo: Repository<GoodsReceiptEntity>,
    @InjectRepository(GoodsReceiptItemEntity)
    private readonly receiptItemRepo: Repository<GoodsReceiptItemEntity>,
    @InjectRepository(SupplierEntity)
    private readonly supplierRepo: Repository<SupplierEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(GoodsReceiptItemDiscrepancyEntity)
    private readonly discrepancyRepo: Repository<GoodsReceiptItemDiscrepancyEntity>,
    @InjectRepository(GlobalConfigEntity)
    private readonly globalConfigRepo: Repository<GlobalConfigEntity>,
    private readonly inventoryService: InventoryService,
    private readonly auditService: AuditService,
    private readonly pricesService: PricesService,
    private readonly approvalEngine: ApprovalEngineService,
    private readonly exchangeRatesService: ExchangeRatesService,
    private readonly claimsService: ClaimsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Hard-validations sobre el proveedor antes de aceptar una OC.
   * Reglas (PDF Política OC, Sección 4):
   *  - Bloquear si supplier no existe.
   *  - Bloquear si supplier.isActive = false.
   *  - Bloquear si supplier.rif está vacío o nulo.
   * El frontend ya filtra inactivos en el dropdown, pero el backend es la
   * fuente de verdad: API directa, imports masivos, o cambios concurrentes
   * (proveedor desactivado mientras alguien arma una OC) deben fallar acá.
   */
  private async validateSupplierForOrder(supplierId: string): Promise<void> {
    const supplier = await this.supplierRepo.findOne({ where: { id: supplierId } });
    if (!supplier) {
      throw new NotFoundException(`Proveedor no encontrado.`);
    }
    if (!supplier.isActive) {
      throw new ConflictException(
        `El proveedor "${supplier.tradeName ?? supplier.businessName}" está inactivo. ` +
          `Reactívalo desde el módulo de Proveedores antes de generar una orden de compra.`,
      );
    }
    if (!supplier.rif?.trim()) {
      throw new ConflictException(
        `El proveedor "${supplier.tradeName ?? supplier.businessName}" no tiene RIF registrado. ` +
          `Completa el RIF en el módulo de Proveedores antes de generar una orden de compra.`,
      );
    }
  }

  // ─── PURCHASE ORDERS ──────────────────────────────────────────────────

  async findAllOrders(
    query: QueryPurchaseOrderDto,
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
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

    const enriched = data.map((o) => ({
      ...o,
      daysUntilAutoCancel: PurchasesService.computeDaysUntilAutoCancel(o),
    }));

    return { data: enriched, total, page, limit };
  }

  async findOneOrder(id: string): Promise<any> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');

    const items = await this.orderItemRepo.find({ where: { orderId: id }, order: { createdAt: 'ASC' } });

    return {
      ...order,
      items,
      daysUntilAutoCancel: PurchasesService.computeDaysUntilAutoCancel(order),
    };
  }

  async createOrder(dto: CreatePurchaseOrderDto, userId: string): Promise<PurchaseOrderEntity> {
    if (!dto.items.length) throw new BadRequestException('La orden debe tener al menos un ítem');

    await this.validateSupplierForOrder(dto.supplierId);

    const orderNumber = await this.generateOrderNumber();

    // QA: la OC solo solicita unidades. Si el frontend manda costo (legacy),
    // lo respetamos; si no, dejamos 0 — el costo real se captura en la
    // recepción cuando llega la factura del proveedor.
    let subtotalUsd = 0;
    const itemsData = dto.items.map((item) => {
      const unitCost = item.unitCostUsd ?? 0;
      const discount = item.discountPct || 0;
      const itemSubtotal = item.quantity * unitCost * (1 - discount / 100);
      subtotalUsd += itemSubtotal;
      return { ...item, unitCostUsd: unitCost, subtotalUsd: itemSubtotal, discountPct: discount };
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

    // Reemplazo de items SOLO en draft: en otros estados pudo haber
    // recepciones contra la OC y borrar items causaría inconsistencias en
    // kardex y reportes. Para esos casos usar cancelOrder + crear nueva.
    if (dto.items != null) {
      if (order.status !== 'draft') {
        throw new BadRequestException(
          'Solo se pueden modificar los ítems de una OC en estado borrador. Para órdenes enviadas o parciales, cancela y crea una nueva.',
        );
      }
      if (dto.items.length === 0) {
        throw new BadRequestException('La orden debe tener al menos un ítem');
      }
    }

    const oldValues = { ...order };

    return this.dataSource.transaction(async (manager) => {
      // Header (status / expectedDate / notes)
      Object.assign(order, {
        ...(dto.status !== undefined && { status: dto.status }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
        expectedDate: dto.expectedDate ? new Date(dto.expectedDate) : order.expectedDate,
      });
      await manager.save(order);

      // Items (reemplazo total). unitCostUsd y subtotalUsd quedan en 0: la
      // OC ya no carga costos (Tier A) — el costo real se captura en la
      // recepción contra la factura del proveedor.
      if (dto.items != null) {
        await manager.delete(PurchaseOrderItemEntity, { orderId: id });
        const newItems = dto.items.map((it) =>
          manager.create(PurchaseOrderItemEntity, {
            orderId: id,
            productId: it.productId,
            quantity: it.quantity,
            unitCostUsd: 0,
            discountPct: 0,
            subtotalUsd: 0,
          }),
        );
        await manager.save(newItems);
        order.subtotalUsd = 0;
        order.taxUsd = 0;
        order.totalUsd = 0;
        await manager.save(order);
      }

      await this.auditService.log({
        tableName: 'purchase_orders',
        recordId: id,
        action: 'UPDATE',
        oldValues,
        newValues: order,
        userId,
      });

      return this.findOneOrder(id);
    });
  }

  /**
   * Elimina físicamente una OC en estado borrador. Solo se permite en draft:
   * en cualquier otro estado la OC pudo ser referenciada por recepciones, así
   * que se debe usar cancelOrder (status='cancelled') para preservar auditoría.
   */
  async deleteOrder(id: string, userId: string): Promise<void> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    if (order.status !== 'draft') {
      throw new BadRequestException('Solo se pueden eliminar órdenes en borrador. Para otros estados usa cancelar.');
    }

    const oldValues = { ...order };
    // Eliminamos primero los ítems para no dejar registros huérfanos.
    await this.orderItemRepo.delete({ orderId: id });
    await this.orderRepo.delete({ id });

    await this.auditService.log({
      tableName: 'purchase_orders',
      recordId: id,
      action: 'DELETE',
      oldValues,
      newValues: null,
      userId,
    });
  }

  async approveOrder(id: string, userId: string): Promise<PurchaseOrderEntity> {
    const order = await this.orderRepo.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Orden de compra no encontrada');
    if (order.status !== 'draft') throw new BadRequestException('Solo se pueden aprobar órdenes en borrador');

    // Re-valida el proveedor: pudo ser desactivado o quedarse sin RIF mientras
    // la OC estaba en borrador. No queremos enviar OCs a proveedores inválidos.
    await this.validateSupplierForOrder(order.supplierId);

    // Motor de aprobación (PDF Política OC §1+2). Para consignaciones y
    // contenedores sin reglas configuradas, el engine retorna `bypassed=true`
    // y cualquier user con permiso de aprobar puede firmar (comportamiento legacy).
    const check = await this.approvalEngine.checkUserCanApprove(id, userId);
    if (!check.canApprove) {
      throw new ForbiddenException(check.denialReason ?? 'No tienes autoridad para aprobar esta OC.');
    }

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
      qb.andWhere(
        `EXISTS (
          SELECT 1 FROM goods_receipt_items ri
           WHERE ri.receipt_id = r.id
             AND ri.purchase_order_id = :purchaseOrderId
        )`,
        { purchaseOrderId: query.purchaseOrderId },
      );
    }
    if (query.from) qb.andWhere('r.receiptDate >= :from', { from: query.from });
    if (query.to) qb.andWhere('r.receiptDate <= :to', { to: query.to });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('r.createdAt', 'DESC')
      .getManyAndCount();

    if (data.length > 0) {
      const receiptIds = data.map((r) => r.id);
      const orderIdsByReceipt = await this.receiptItemRepo
        .createQueryBuilder('ri')
        .select('ri.receipt_id', 'receiptId')
        .addSelect('ARRAY_AGG(DISTINCT ri.purchase_order_id)', 'orderIds')
        .where('ri.receipt_id IN (:...receiptIds)', { receiptIds })
        .andWhere('ri.purchase_order_id IS NOT NULL')
        .groupBy('ri.receipt_id')
        .getRawMany<{ receiptId: string; orderIds: string[] }>();
      const byReceipt = new Map(orderIdsByReceipt.map((r) => [r.receiptId, r.orderIds ?? []]));
      for (const r of data as Array<GoodsReceiptEntity & { purchaseOrderIds?: string[] }>) {
        r.purchaseOrderIds = byReceipt.get(r.id) ?? [];
      }
    }

    return { data, total, page, limit };
  }

  async findOneReceipt(id: string): Promise<any> {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');

    const items = await this.receiptItemRepo.find({
      where: { receiptId: id },
      relations: ['discrepancies'],
      order: { createdAt: 'ASC' },
    });
    const purchaseOrderIds = [...new Set(items.map((it) => it.purchaseOrderId).filter((v): v is string => !!v))];

    return { ...receipt, items, purchaseOrderIds };
  }

  async createReceipt(dto: CreateGoodsReceiptDto, userId: string): Promise<GoodsReceiptEntity> {
    if (!dto.items.length) throw new BadRequestException('La recepción debe tener al menos un ítem');

    // ─── Validación de OCs referenciadas ─────────────────────────────────────
    const orderIds = Array.from(new Set(dto.items.map((i) => i.purchaseOrderId).filter((v): v is string => !!v)));
    if (orderIds.length > 0) {
      const orders = await this.orderRepo.findByIds(orderIds);
      if (orders.length !== orderIds.length) {
        throw new NotFoundException('Una o más órdenes de compra referenciadas no existen');
      }
      for (const order of orders) {
        if (order.supplierId !== dto.supplierId) {
          throw new BadRequestException(
            `La orden "${order.orderNumber}" es de otro proveedor y no puede consolidarse en esta factura.`,
          );
        }
        if (order.status === 'draft') {
          throw new BadRequestException(
            `La orden "${order.orderNumber}" está en borrador. Apruébala antes de recibir contra ella.`,
          );
        }
        if (order.status === 'cancelled' || order.status === 'complete') {
          throw new BadRequestException(
            `La orden "${order.orderNumber}" está en estado "${order.status}" y no admite más recepciones.`,
          );
        }
      }
    }

    // ─── Tolerancias y validación de discrepancias por línea (PDF §5) ────────
    const tolerances = await this.getReceiptTolerances();
    const ocItemLookup = await this.buildOcItemLookup(orderIds);
    const productNameById = await this.buildProductNameLookup(dto.items.map((i) => i.productId));
    const productTracksExpirationById = await this.buildProductTracksExpirationLookup(
      dto.items.map((i) => i.productId),
    );

    // Validamos que la suma de cantidades de discrepancias por línea cuadre con
    // |invoiced - received|. También detectamos si alguna línea excede tolerancia.
    let toleranceExceeded = false;
    const toleranceDetails: string[] = [];
    for (const item of dto.items) {
      this.validateLineDiscrepancies(item, productNameById, productTracksExpirationById);
      const exceptions = this.evaluateLineTolerances(item, ocItemLookup, tolerances, productNameById);
      if (exceptions.length > 0) {
        toleranceExceeded = true;
        toleranceDetails.push(...exceptions);
      }
    }

    const receiptNumber = await this.generateReceiptNumber();

    // ─── Moneda nativa de la factura (Fase D) ─────────────────────────────
    // Si la factura viene en VES exigimos `nativeTotal`. La tasa puede venir
    // explícita (operador la sobreescribió) o se resuelve de la última tasa
    // BCV registrada. El snapshot queda inmutable en el receipt para auditar
    // contra la factura física aunque la tasa cambie después.
    const nativeContext = await this.resolveNativeCurrency(dto);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const round = (n: number) => Math.round(n * 10000) / 10000;

      // IVA por línea según taxType del producto. Cargamos los productos
      // relevantes para resolver su taxType y calcular la alícuota correcta.
      // Medicamentos exentos no pagan IVA; misceláneos pagan general; algunos
      // pagan reducido. El dto.taxPct llega como promedio informativo desde
      // el frontend pero NO se aplica al subtotal — la autoridad del cálculo
      // es el taxType de cada producto.
      const ivaRates = await this.getIvaRates();
      const productIds = Array.from(new Set(dto.items.map((i) => i.productId)));
      const productsForTax = await this.productRepo.find({
        where: productIds.map((id) => ({ id })),
      });
      const productTaxTypeById = new Map(productsForTax.map((p) => [p.id, p.taxType] as const));

      let subtotalUsd = 0;
      let totalDiscountUsd = 0;
      let taxUsd = 0;
      const itemsComputed = dto.items.map((item) => {
        const discountPct = item.discountPct || 0;
        // Subtotal usa cantidad FACTURADA (lo que cobra el proveedor),
        // no la recibida. La diferencia se rastrea como discrepancia y se
        // reclama por nota de crédito; pero la factura original cobra lo
        // facturado.
        const invoicedQty = item.invoicedQuantity ?? item.quantity;
        const gross = invoicedQty * item.unitCostUsd;
        const discountAmount = gross * (discountPct / 100);
        const itemSubtotal = gross - discountAmount;
        const lineTaxPct = this.resolveProductTaxPct(productTaxTypeById.get(item.productId), ivaRates);
        const itemTax = itemSubtotal * (lineTaxPct / 100);
        subtotalUsd += itemSubtotal;
        totalDiscountUsd += discountAmount;
        taxUsd += itemTax;
        return { item, discountPct, itemSubtotal: round(itemSubtotal) };
      });

      // QA #104: descuentos comerciales a nivel documento. Orden de aplicación:
      //   1. Lineal (ya aplicado por línea en el loop de arriba) → subtotalUsd
      //   2. Header + Volume sobre subtotalUsd → netSubtotal
      //   3. IVA recalculado sobre netSubtotal (proporción del taxUsd original)
      //   4. IGTF sobre (netSubtotal + tax), solo si moneda USD
      // Pronto pago NO se aplica acá — se aplica en el módulo de Pagos
      // (Cuentas por Pagar) cuando se concrete el pago dentro del plazo.
      const headerDiscPct = dto.headerDiscountPct || 0;
      const volumeDiscPct = dto.volumeDiscountPct || 0;
      const headerDiscountUsd = subtotalUsd * (headerDiscPct / 100);
      const volumeDiscountUsd = subtotalUsd * (volumeDiscPct / 100);
      const netSubtotalUsd = subtotalUsd - headerDiscountUsd - volumeDiscountUsd;
      // El IVA se calcula sobre el net del descuento (es lo que cobra el
      // proveedor en factura). Como el taxUsd original estaba sobre subtotal
      // bruto, lo escalamos proporcionalmente para mantener la composición
      // per-producto correcta.
      const taxScale = subtotalUsd > 0 ? netSubtotalUsd / subtotalUsd : 0;
      const adjustedTaxUsd = taxUsd * taxScale;

      // Promedio ponderado para registrar en el receipt (informativo).
      const taxPct = netSubtotalUsd > 0 ? (adjustedTaxUsd / netSubtotalUsd) * 100 : 0;
      // IGTF (3% Venezuela) sólo aplica a pagos en divisas. Si la factura
      // del proveedor está en Bs., no aplica IGTF — sin importar lo que
      // venga configurado globalmente.
      const igtfPct = nativeContext.currency === 'VES' ? 0 : dto.igtfPct || 0;
      const igtfUsd = (netSubtotalUsd + adjustedTaxUsd) * (igtfPct / 100);
      const totalUsd = netSubtotalUsd + adjustedTaxUsd + igtfUsd;

      const receipt = this.receiptRepo.create({
        branchId: dto.branchId,
        supplierId: dto.supplierId,
        receiptNumber,
        receiptType: dto.receiptType || 'purchase',
        supplierInvoiceNumber: dto.supplierInvoiceNumber || null,
        notes: dto.notes || null,
        subtotalUsd: round(subtotalUsd),
        totalDiscountUsd: round(totalDiscountUsd),
        headerDiscountPct: headerDiscPct,
        headerDiscountUsd: round(headerDiscountUsd),
        volumeDiscountPct: volumeDiscPct,
        volumeDiscountUsd: round(volumeDiscountUsd),
        // Pronto pago siempre 0 en recepción; se actualiza desde Pagos.
        promptPaymentDiscountPct: 0,
        promptPaymentDiscountUsd: 0,
        taxPct,
        taxUsd: round(adjustedTaxUsd),
        igtfPct,
        igtfUsd: round(igtfUsd),
        totalUsd: round(totalUsd),
        receivedBy: userId,
        // PDF §5 Q5 = b: bloquear y requerir reaprobación si excede tolerancia.
        // Mientras esté bloqueada NO se crean lotes ni se publica precio.
        requiresReapproval: toleranceExceeded,
        nativeCurrency: nativeContext.currency,
        nativeTotal: nativeContext.total,
        exchangeRateUsed: nativeContext.rate,
        exchangeRateId: nativeContext.rateId,
      });

      const savedReceipt = await queryRunner.manager.save(receipt);

      for (const { item, discountPct, itemSubtotal } of itemsComputed) {
        // Solo creamos lote si la recepción NO está bloqueada por reaprobación
        // Y si efectivamente llegó stock (quantity > 0). Una línea con
        // quantity=0 significa que todo lo facturado quedó como discrepancia
        // (ej. la ampolla llegó dañada): se guarda el receipt_item para que
        // el reclamo auto-generado tenga la trazabilidad, pero no crea lote.
        let lotId: string | null = null;
        if (!toleranceExceeded && item.quantity > 0) {
          // lotNumber/expirationDate ya validados como obligatorios en
          // validateLineDiscrepancies cuando quantity > 0. Si el producto
          // no trackea vencimiento (consumo masivo), usamos un sentinel
          // far-future para que FEFO lo ordene al final sin necesidad de
          // hacer nullable la columna.
          const tracks = productTracksExpirationById.get(item.productId) ?? true;
          const expDate = item.expirationDate || (tracks ? '' : '2099-12-31');
          const lot = await this.inventoryService.createLot(
            {
              productId: item.productId,
              branchId: dto.branchId,
              lotNumber: item.lotNumber!,
              expirationDate: expDate,
              quantityReceived: item.quantity,
              costUsd: item.unitCostUsd,
              // salePrice opcional (Fase E): si no viene, el lote se crea con 0 y la
              // fijación queda al módulo de Precios. La publicación de precio abajo
              // ya filtra por `> 0`, así que no se publica ningún precio basura.
              salePrice: item.salePrice ?? 0,
              acquisitionType: dto.receiptType === 'consignment' ? 'consignment' : 'purchase',
              supplierId: dto.supplierId,
            },
            userId,
          );
          lotId = lot.id;
        }

        // Cuando la línea no recibió stock físico (todo quedó como discrepancia)
        // no tenemos lote/vencimiento reales. Usamos placeholders para satisfacer
        // las columnas NOT NULL — el receipt_item queda como referencia para el
        // reclamo y para la trazabilidad de la OC, sin afectar inventario.
        const lotNumberToStore = item.quantity > 0 ? (item.lotNumber ?? '') : 'SIN-LOTE';
        const expirationDateToStore =
          item.quantity > 0 && item.expirationDate ? new Date(item.expirationDate) : new Date(); // Fecha de la recepción como placeholder

        const receiptItem = this.receiptItemRepo.create({
          receiptId: savedReceipt.id,
          purchaseOrderId: item.purchaseOrderId || null,
          productId: item.productId,
          lotId,
          quantity: item.quantity,
          invoicedQuantity: item.invoicedQuantity ?? item.quantity,
          unitCostUsd: item.unitCostUsd,
          discountPct,
          subtotalUsd: itemSubtotal,
          salePrice: item.salePrice ?? 0,
          lotNumber: lotNumberToStore,
          expirationDate: expirationDateToStore,
        });
        const savedItem = await queryRunner.manager.save(receiptItem);

        // Discrepancias por línea (si las hay)
        if (item.discrepancies?.length) {
          const discrepancyEntities = item.discrepancies.map((d) =>
            queryRunner.manager.create(GoodsReceiptItemDiscrepancyEntity, {
              receiptItemId: savedItem.id,
              reason: d.reason,
              quantity: d.quantity,
              notes: d.notes ?? null,
            }),
          );
          await queryRunner.manager.save(discrepancyEntities);
        }
      }

      // Solo recalculamos status de OCs si la recepción NO está bloqueada.
      // Si está bloqueada, el `quantityReceived` de la OC no debe avanzar
      // todavía — eso pasa al reaprobar.
      const affectedOrders: Array<{
        orderNumber: string;
        previousStatus: string;
        newStatus: string;
      }> = [];
      if (!toleranceExceeded) {
        for (const orderId of orderIds) {
          const result = await this.updateOrderStatusAfterReceipt(orderId, queryRunner.manager);
          if (result) affectedOrders.push(result);
        }
      }

      if (toleranceExceeded) {
        this.logger.warn(`[receipt ${receiptNumber}] Bloqueada por tolerancia: ${toleranceDetails.join('; ')}`);
      } else if (affectedOrders.length > 0) {
        this.logger.log(
          `[receipt ${receiptNumber}] OCs recalculadas: ${affectedOrders
            .map((o) => `${o.orderNumber} ${o.previousStatus}→${o.newStatus}`)
            .join(', ')}`,
        );
      }

      await queryRunner.commitTransaction();

      // Fuera de la tx: publicar precios solo si la recepción NO está bloqueada.
      // Solo publicamos cuando salePrice > 0 — si el operador lo dejó vacío
      // (Fase E), la fijación queda al módulo de Precios y no creamos un precio
      // basura para luego tener que expirarlo.
      if (!toleranceExceeded) {
        const latestPriceByProduct = new Map<string, number>();
        for (const item of dto.items) {
          if (item.salePrice != null && item.salePrice > 0) {
            latestPriceByProduct.set(item.productId, item.salePrice);
          }
        }
        for (const [productId, priceUsd] of latestPriceByProduct) {
          try {
            await this.pricesService.create(
              {
                productId,
                branchId: dto.branchId,
                priceUsd,
                notes: `Publicado desde recepción ${receiptNumber}`,
              },
              userId,
            );
          } catch {
            // No abortamos la recepción por fallos al publicar precios.
          }
        }
      }

      // Auto-genera reclamo al proveedor si la recepción tiene discrepancias.
      // Se ejecuta fuera de la transacción principal: si el claim falla, la
      // recepción sigue válida y se reporta el error en logs.
      let autoClaim: { id: string; claimNumber: string } | null = null;
      if (!toleranceExceeded) {
        autoClaim = await this.autoGenerateClaimFromReceipt({
          receiptId: savedReceipt.id,
          receiptNumber,
          supplierId: dto.supplierId,
          branchId: dto.branchId,
          userId,
        });
      }

      const result = await this.findOneReceipt(savedReceipt.id);
      return {
        ...result,
        affectedOrders,
        toleranceExceeded,
        toleranceDetails: toleranceExceeded ? toleranceDetails : undefined,
        autoClaim,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── REAPPROVE RECEIPT ─────────────────────────────────────────────────
  /**
   * Reaprueba una recepción que excedió tolerancia (PDF Política OC §5).
   * Pasos:
   *   1. Valida que la recepción exista y esté `requiresReapproval=true`.
   *   2. Crea los lotes para cada item (que tenían `lotId=null`).
   *   3. Actualiza `requires_reapproval=false` + audit fields.
   *   4. Recalcula status de las OCs asociadas.
   *   5. Publica precios al módulo de pricing.
   *
   * La autoridad para reaprobar la decide el motor de aprobación de Fase B
   * (mismo rol que aprobaría una OC del monto de esta recepción).
   */
  async reapproveReceipt(id: string, userId: string, dto: ReapproveReceiptDto): Promise<GoodsReceiptEntity> {
    const receipt = await this.receiptRepo.findOne({ where: { id } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');
    if (!receipt.requiresReapproval) {
      throw new BadRequestException('Esta recepción no requiere reaprobación.');
    }

    const items = await this.receiptItemRepo.find({ where: { receiptId: id } });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Crear lote por cada ítem y actualizar el FK
      for (const item of items) {
        if (item.lotId) continue; // ya existe (no debería pasar pero defensivo)
        // expirationDate puede llegar como string (columna `date` en PG) o Date.
        const expirationDateStr =
          item.expirationDate instanceof Date
            ? item.expirationDate.toISOString().slice(0, 10)
            : String(item.expirationDate).slice(0, 10);
        const lot = await this.inventoryService.createLot(
          {
            productId: item.productId,
            branchId: receipt.branchId,
            lotNumber: item.lotNumber,
            expirationDate: expirationDateStr,
            quantityReceived: Number(item.quantity),
            costUsd: Number(item.unitCostUsd),
            salePrice: Number(item.salePrice),
            acquisitionType: receipt.receiptType === 'consignment' ? 'consignment' : 'purchase',
            supplierId: receipt.supplierId,
          },
          userId,
        );
        await queryRunner.manager.update(GoodsReceiptItemEntity, item.id, { lotId: lot.id });
      }

      // Marcar como reaprobada
      await queryRunner.manager.update(GoodsReceiptEntity, id, {
        requiresReapproval: false,
        reapprovedBy: userId,
        reapprovedAt: new Date(),
        reapprovalJustification: dto.justification,
      });

      // Recalcular status de OCs asociadas
      const orderIds = Array.from(new Set(items.map((i) => i.purchaseOrderId).filter((v): v is string => !!v)));
      const affectedOrders: Array<{
        orderNumber: string;
        previousStatus: string;
        newStatus: string;
      }> = [];
      for (const orderId of orderIds) {
        const result = await this.updateOrderStatusAfterReceipt(orderId, queryRunner.manager);
        if (result) affectedOrders.push(result);
      }

      await this.auditService.log({
        tableName: 'goods_receipts',
        recordId: id,
        action: 'UPDATE',
        newValues: {
          requiresReapproval: false,
          reapprovedBy: userId,
          justification: dto.justification,
        },
        userId,
        justification: dto.justification,
      });

      await queryRunner.commitTransaction();

      // Publicar precios fuera de la tx
      const latestPriceByProduct = new Map<string, number>();
      for (const item of items) {
        const price = Number(item.salePrice);
        if (price > 0) latestPriceByProduct.set(item.productId, price);
      }
      for (const [productId, priceUsd] of latestPriceByProduct) {
        try {
          await this.pricesService.create(
            {
              productId,
              branchId: receipt.branchId,
              priceUsd,
              notes: `Publicado tras reaprobación de recepción ${receipt.receiptNumber}`,
            },
            userId,
          );
        } catch {
          // No abortamos por fallo de pricing.
        }
      }

      this.logger.log(
        `[receipt ${receipt.receiptNumber}] reaprobada por user ${userId}. ${
          affectedOrders.length > 0
            ? `OCs: ${affectedOrders.map((o) => `${o.orderNumber}→${o.newStatus}`).join(', ')}`
            : 'Sin OCs asociadas'
        }`,
      );

      const result = await this.findOneReceipt(id);
      return { ...result, affectedOrders };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  // ─── Helpers Fase D: moneda nativa + tasa BCV ──────────────────────────
  /**
   * Resuelve los campos de moneda nativa para una recepción. Si la factura
   * vino en VES, valida que se haya enviado el `nativeTotal` y resuelve la
   * tasa: si el operador la mandó explícita la respetamos; si no, tomamos la
   * última tasa registrada en `exchange_rates` (cron BCV o override manual).
   *
   * El snapshot que retorna se persiste tal cual: queda inmutable aunque la
   * tasa BCV cambie después. Esto es crítico para auditar contra la factura.
   */
  private async resolveNativeCurrency(dto: CreateGoodsReceiptDto): Promise<{
    currency: 'USD' | 'VES';
    total: number | null;
    rate: number | null;
    rateId: string | null;
  }> {
    const currency = dto.nativeCurrency ?? 'USD';
    if (currency === 'USD') {
      // Factura ya en USD: no guardamos total nativo ni tasa (constraint en BD).
      return { currency: 'USD', total: null, rate: null, rateId: null };
    }

    if (dto.nativeTotal == null || dto.nativeTotal <= 0) {
      throw new BadRequestException(
        'Para recepciones con moneda nativa VES, debes informar el total de la factura en bolívares (`nativeTotal`).',
      );
    }

    // Resolución de tasa: explícita > última tasa registrada.
    let rate = dto.exchangeRateUsed;
    let rateId: string | null = null;
    if (rate == null) {
      const latest = await this.exchangeRatesService.getLatest('USD', 'VES');
      if (!latest) {
        throw new BadRequestException(
          'No hay tasa BCV registrada para USD→VES. Sincroniza la tasa o envía `exchangeRateUsed` explícito.',
        );
      }
      rate = Number(latest.rate);
      rateId = latest.id;
    } else {
      // Si el operador dio una tasa explícita, intentamos asociarla con el
      // registro de exchange_rates más reciente para traceability. Best-effort:
      // si no coincide exactamente, dejamos rateId NULL (la tasa snapshot ya
      // queda en el campo, no perdemos auditoría).
      const latest = await this.exchangeRatesService.getLatest('USD', 'VES');
      if (latest && Number(latest.rate) === rate) {
        rateId = latest.id;
      }
    }

    return {
      currency: 'VES',
      total: Math.round(dto.nativeTotal * 10000) / 10000,
      rate: Math.round(rate * 10000) / 10000,
      rateId,
    };
  }

  // ─── Helpers Fase C: tolerancias y discrepancias ───────────────────────
  /**
   * Lee las dos tolerancias de `global_config`. Si las keys no existen en BD
   * (instalación legacy sin Fase C seeded), retorna defaults seguros.
   */
  private async getReceiptTolerances(): Promise<{ quantityPct: number; costPct: number }> {
    const rows = await this.globalConfigRepo.find({
      where: [{ key: 'purchase_tolerance_quantity_pct' }, { key: 'purchase_tolerance_cost_pct' }],
    });
    const byKey = new Map(rows.map((r) => [r.key, Number(r.value)]));
    return {
      quantityPct: byKey.get('purchase_tolerance_quantity_pct') ?? 5,
      costPct: byKey.get('purchase_tolerance_cost_pct') ?? 10,
    };
  }

  /**
   * Lee las alícuotas de IVA configuradas (SUNDDE). Default seguro: 16/8
   * si las keys aún no fueron sembradas en BD.
   */
  private async getIvaRates(): Promise<{ generalPct: number; reducedPct: number }> {
    const rows = await this.globalConfigRepo.find({
      where: [{ key: 'iva_general_pct' }, { key: 'iva_reduced_pct' }],
    });
    const byKey = new Map(rows.map((r) => [r.key, Number(r.value)]));
    return {
      generalPct: byKey.get('iva_general_pct') ?? 16,
      reducedPct: byKey.get('iva_reduced_pct') ?? 8,
    };
  }

  /**
   * Resuelve el % de IVA aplicable a un producto según su taxType.
   * exempt → 0; reduced → alícuota reducida; general (default) → alícuota general.
   */
  private resolveProductTaxPct(
    taxType: string | null | undefined,
    rates: { generalPct: number; reducedPct: number },
  ): number {
    if (!taxType || taxType === 'exempt') return 0;
    if (taxType === 'reduced') return rates.reducedPct;
    return rates.generalPct;
  }

  /**
   * Construye un mapa `${orderId}:${productId}` → ítem de OC para que el
   * evaluador de tolerancias compare contra la cantidad y costo originales.
   */
  private async buildOcItemLookup(orderIds: string[]): Promise<Map<string, PurchaseOrderItemEntity>> {
    if (orderIds.length === 0) return new Map();
    const ocItems = await this.orderItemRepo.find({
      where: orderIds.map((id) => ({ orderId: id })),
    });
    return new Map(ocItems.map((it) => [`${it.orderId}:${it.productId}`, it]));
  }

  /**
   * Mapa productId → nombre legible (shortName ?? description). Lo usamos para
   * que los mensajes de error/tolerancia muestren nombres en vez de UUIDs.
   */
  private async buildProductNameLookup(productIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(productIds)];
    if (unique.length === 0) return new Map();
    const products = await this.productRepo.find({ where: unique.map((id) => ({ id })) });
    return new Map(products.map((p) => [p.id, p.shortName ?? p.description] as const));
  }

  /** Mapa productId → tracksExpiration. Default true para legacy. */
  private async buildProductTracksExpirationLookup(productIds: string[]): Promise<Map<string, boolean>> {
    const unique = [...new Set(productIds)];
    if (unique.length === 0) return new Map();
    const products = await this.productRepo.find({ where: unique.map((id) => ({ id })) });
    return new Map(products.map((p) => [p.id, p.tracksExpiration ?? true] as const));
  }

  /**
   * Valida que la suma de cantidades de discrepancias por línea cuadre con
   * la diferencia entre lo facturado y lo recibido (|invoicedQty - quantity|).
   * Si no cuadra, lanza BadRequestException.
   *
   * Esta es la regla "cuadrar a cero" del PDF §5: si reportas faltantes/sobrantes,
   * la suma de razones debe explicar exactamente la diferencia.
   */
  private validateLineDiscrepancies(
    item: CreateGoodsReceiptDto['items'][number],
    productNameById: Map<string, string>,
    productTracksExpiration: Map<string, boolean>,
  ): void {
    const invoiced = item.invoicedQuantity ?? item.quantity;
    const received = item.quantity;
    const diff = Math.abs(invoiced - received);
    const totalDiscrepancyQty = (item.discrepancies ?? []).reduce((s, d) => s + Number(d.quantity), 0);
    const productLabel = productNameById.get(item.productId) ?? item.productId.slice(0, 8);
    // Default true: si por alguna razón no encontramos el producto en el
    // mapa, exigimos vencimiento (comportamiento legacy seguro).
    const tracksExpiration = productTracksExpiration.get(item.productId) ?? true;

    // Si la línea recibió stock físico, lote es obligatorio. El vencimiento
    // se exige solo si el producto lo trackea (consumo masivo sin caducidad
    // queda exento — QA #109).
    if (received > 0) {
      if (!item.lotNumber?.trim()) {
        throw new BadRequestException(
          `Producto "${productLabel}": número de lote es obligatorio cuando se recibe stock (quantity > 0).`,
        );
      }
      if (tracksExpiration && !item.expirationDate) {
        throw new BadRequestException(
          `Producto "${productLabel}": fecha de vencimiento es obligatoria cuando se recibe stock (quantity > 0).`,
        );
      }
    }

    // Si quantity=0 y NO hay discrepancias, la línea no tiene sentido (ni
    // entró stock ni se está reclamando nada). Rechazamos para evitar registros
    // huérfanos en la BD.
    if (received === 0 && totalDiscrepancyQty < 0.001) {
      throw new BadRequestException(
        `Producto "${productLabel}": recibiste 0 unidades sin reportar discrepancias. ` +
          `Indica al menos una razón (vencido, dañado, etc.) o elimina la línea.`,
      );
    }

    // Tolerancia de 0.001 para comparaciones decimales.
    const epsilon = 0.001;
    if (diff > epsilon && totalDiscrepancyQty < epsilon) {
      throw new BadRequestException(
        `Producto "${productLabel}": la cantidad facturada (${invoiced}) difiere ` +
          `de la recibida (${received}) pero no se reportaron discrepancias. ` +
          `Agrega razones que sumen ${diff.toFixed(3)}.`,
      );
    }
    if (Math.abs(totalDiscrepancyQty - diff) > epsilon) {
      throw new BadRequestException(
        `Producto "${productLabel}": la suma de discrepancias (${totalDiscrepancyQty.toFixed(3)}) ` +
          `no cuadra con la diferencia facturada vs recibida (${diff.toFixed(3)}).`,
      );
    }

    // Si reason='other', exigimos notas que expliquen.
    for (const d of item.discrepancies ?? []) {
      if (d.reason === 'other' && !d.notes?.trim()) {
        throw new BadRequestException(`Discrepancia con razón "other" requiere una nota explicativa.`);
      }
    }
  }

  /**
   * Compara una línea de recepción contra su contraparte en la OC. Retorna
   * lista de excepciones detectadas (vacía si todo está dentro de tolerancia).
   * No lanza: el caller decide qué hacer (bloquear y requerir reaprobación).
   */
  private evaluateLineTolerances(
    item: CreateGoodsReceiptDto['items'][number],
    ocItemLookup: Map<string, PurchaseOrderItemEntity>,
    tolerances: { quantityPct: number; costPct: number },
    productNameById: Map<string, string>,
  ): string[] {
    if (!item.purchaseOrderId) return []; // ítem sin OC: no hay contra qué comparar.
    const ocItem = ocItemLookup.get(`${item.purchaseOrderId}:${item.productId}`);
    if (!ocItem) return []; // producto no estaba en la OC (es un "extra" agregado).

    const exceptions: string[] = [];
    const orderedQty = Number(ocItem.quantity);
    const remainingQty = orderedQty - Number(ocItem.quantityReceived ?? 0);
    const productLabel = productNameById.get(item.productId) ?? item.productId.slice(0, 8);

    // Cantidad: comparamos contra lo que QUEDA por recibir, no contra el total
    // ordenado. Así una OC parcial no "excede" si está completando lo que faltaba.
    if (remainingQty > 0) {
      const overReceived = item.quantity - remainingQty;
      const overPct = (overReceived / remainingQty) * 100;
      if (overPct > tolerances.quantityPct) {
        exceptions.push(
          `Producto "${productLabel}": recibido ${item.quantity} excede ` +
            `lo pendiente de la OC (${remainingQty}) en ${overPct.toFixed(2)}% ` +
            `(tolerancia: ${tolerances.quantityPct}%).`,
        );
      }
    }

    // Costo: comparamos contra el costo unitario de la OC.
    const ocCost = Number(ocItem.unitCostUsd);
    if (ocCost > 0) {
      const deltaPct = (Math.abs(item.unitCostUsd - ocCost) / ocCost) * 100;
      if (deltaPct > tolerances.costPct) {
        exceptions.push(
          `Producto "${productLabel}": costo $${item.unitCostUsd.toFixed(2)} ` +
            `difiere de la OC ($${ocCost.toFixed(2)}) en ${deltaPct.toFixed(2)}% ` +
            `(tolerancia: ${tolerances.costPct}%).`,
        );
      }
    }

    return exceptions;
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

  /**
   * Recalcula el status de una OC en función de las cantidades recibidas hasta
   * el momento. Si se invoca DENTRO de una transacción que aún no ha commiteado
   * (caso típico: justo después de insertar receipt_items), debe pasarse el
   * `manager` del `QueryRunner` para que la consulta vea los inserts pendientes.
   * Si no se pasa, usa los repositorios normales (caso: invocaciones futuras
   * desde fuera de una tx, ej. recálculo manual).
   */
  private async updateOrderStatusAfterReceipt(
    orderId: string,
    manager?: EntityManager,
  ): Promise<{ orderNumber: string; previousStatus: string; newStatus: string } | null> {
    const orderRepo = manager ? manager.getRepository(PurchaseOrderEntity) : this.orderRepo;
    const orderItemRepo = manager ? manager.getRepository(PurchaseOrderItemEntity) : this.orderItemRepo;
    const receiptItemRepo = manager ? manager.getRepository(GoodsReceiptItemEntity) : this.receiptItemRepo;

    const order = await orderRepo.findOne({ where: { id: orderId } });
    if (!order) return null;

    const items = await orderItemRepo.find({ where: { orderId } });
    if (!items.length) return null;

    const receiptItems = await receiptItemRepo.find({
      where: { purchaseOrderId: orderId },
    });

    const receivedByProduct: Record<string, number> = {};
    for (const ri of receiptItems) {
      receivedByProduct[ri.productId] = (receivedByProduct[ri.productId] || 0) + Number(ri.quantity);
    }

    let allComplete = true;
    let anyReceived = false;

    for (const item of items) {
      const received = receivedByProduct[item.productId] || 0;
      if (received !== Number(item.quantityReceived)) {
        await orderItemRepo.update(item.id, { quantityReceived: received });
      }
      if (received > 0) anyReceived = true;
      if (received < Number(item.quantity)) allComplete = false;
    }

    const previousStatus = order.status;
    let newStatus = previousStatus;
    if (allComplete) {
      newStatus = 'complete';
    } else if (anyReceived) {
      newStatus = 'partial';
    }
    if (newStatus !== previousStatus) {
      await orderRepo.update(orderId, { status: newStatus });
    }

    return { orderNumber: order.orderNumber, previousStatus, newStatus };
  }

  // ─── CRON: AUTO-CANCEL DRAFTS ─────────────────────────────────────────
  /**
   * Cancela automáticamente OCs que llevan más de DRAFT_AUTO_CANCEL_DAYS días
   * en estado `draft`. PDF Política OC, Sección 6.
   *
   * Corre diariamente a las 3 AM (server time) para no chocar con horario
   * laboral. Idempotente: solo afecta filas con status='draft'. Loggea el
   * conteo y los IDs afectados para auditoría.
   */
  @Cron(CronExpression.EVERY_DAY_AT_3AM, { name: 'purchase-orders-auto-cancel-drafts' })
  async autoCancelStaleDrafts(): Promise<void> {
    const result = await this.orderRepo
      .createQueryBuilder()
      .update(PurchaseOrderEntity)
      .set({ status: 'cancelled' })
      .where('status = :status', { status: 'draft' })
      .andWhere(`created_at < NOW() - INTERVAL '${DRAFT_AUTO_CANCEL_DAYS} days'`)
      .returning('id')
      .execute();

    const cancelledCount = result.affected ?? 0;
    if (cancelledCount > 0) {
      const ids = (result.raw as Array<{ id: string }>).map((r) => r.id);
      this.logger.log(
        `[auto-cancel-drafts] Canceladas ${cancelledCount} OCs en draft >${DRAFT_AUTO_CANCEL_DAYS}d: ${ids.join(', ')}`,
      );
    }
  }

  /**
   * Calcula días restantes antes de que una OC en draft se auto-cancele.
   * Retorna `null` si la OC no está en draft (no aplica). El frontend usa
   * este valor para mostrar la etiqueta "vence en N días" cuando sea ≤7.
   */
  static computeDaysUntilAutoCancel(order: Pick<PurchaseOrderEntity, 'status' | 'createdAt'>): number | null {
    if (order.status !== 'draft') return null;
    const createdMs = new Date(order.createdAt).getTime();
    const expiresMs = createdMs + DRAFT_AUTO_CANCEL_DAYS * 24 * 60 * 60 * 1000;
    const remainingMs = expiresMs - Date.now();
    // Math.ceil porque "1.4 días restantes" se debe mostrar como 2.
    // Si está vencida (remaining < 0) devolvemos 0 — el cron diario la limpiará.
    return Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  }

  /**
   * Mapeo de razones de discrepancia → claim_type del módulo de reclamos.
   * El claim resultante se categoriza por la razón predominante: si hay 5
   * líneas con "missing" y 1 con "defective", el claim queda como "quantity".
   * En empate gana el primero de la lista (orden de severidad).
   */
  private inferClaimType(reasons: string[]): 'quality' | 'quantity' | 'price_mismatch' | 'other' {
    const counts: Record<string, number> = {};
    for (const r of reasons) counts[r] = (counts[r] || 0) + 1;
    const qualityReasons = ['expired', 'defective', 'damaged_packaging', 'damaged_in_transit', 'quality_failure'];
    const quantityReasons = ['missing', 'excess'];
    const qualityCount = qualityReasons.reduce((acc, r) => acc + (counts[r] || 0), 0);
    const quantityCount = quantityReasons.reduce((acc, r) => acc + (counts[r] || 0), 0);
    if (qualityCount > quantityCount) return 'quality';
    if (quantityCount > qualityCount) return 'quantity';
    if (qualityCount > 0) return 'quality';
    return 'other';
  }

  private readonly REASON_LABEL: Record<string, string> = {
    expired: 'Vencido',
    defective: 'Defectuoso',
    damaged_packaging: 'Empaque dañado',
    damaged_in_transit: 'Daño en tránsito',
    incorrect_product: 'Producto incorrecto',
    missing: 'Faltante',
    excess: 'Sobrante',
    quality_failure: 'Falla de calidad',
    other: 'Otro',
  };

  /**
   * Genera automáticamente un reclamo al proveedor cuando una recepción tiene
   * líneas con discrepancias. Calcula monto sumando `quantity × unit_cost_usd`
   * de cada línea afectada e infiere el tipo de reclamo de las razones.
   *
   * Si no hay discrepancias, no hace nada. Se invoca FUERA de la transacción
   * principal del receipt para evitar acoplamiento: si la creación del claim
   * falla, no rompe el commit del receipt — solo loggeamos el error.
   */
  private async autoGenerateClaimFromReceipt(input: {
    receiptId: string;
    receiptNumber: string;
    supplierId: string;
    branchId: string;
    userId: string;
  }): Promise<{ id: string; claimNumber: string } | null> {
    const items = await this.receiptItemRepo.find({
      where: { receiptId: input.receiptId },
      relations: ['discrepancies'],
    });

    const affectedLines = items.filter((it) => (it.discrepancies?.length ?? 0) > 0);
    if (affectedLines.length === 0) return null;

    const productNameById = await this.buildProductNameLookup(affectedLines.map((it) => it.productId));

    const allReasons: string[] = [];
    let amountUsd = 0;
    const descriptionLines: string[] = [
      `Reclamo automático generado por discrepancias en la recepción ${input.receiptNumber}.`,
      '',
      'Líneas afectadas:',
    ];

    for (const item of affectedLines) {
      const cost = Number(item.unitCostUsd) || 0;
      const productName = productNameById.get(item.productId) ?? item.productId;
      for (const d of item.discrepancies ?? []) {
        const qty = Number(d.quantity) || 0;
        const reason = String(d.reason);
        allReasons.push(reason);
        amountUsd += qty * cost;
        const reasonLabel = this.REASON_LABEL[reason] ?? reason;
        const notesPart = d.notes ? ` — ${d.notes}` : '';
        descriptionLines.push(
          `• ${productName} · ${reasonLabel} · ${qty} ${qty === 1 ? 'unidad' : 'unidades'} · $${(qty * cost).toFixed(2)}${notesPart}`,
        );
      }
    }

    const claimType = this.inferClaimType(allReasons);

    try {
      const claim = await this.claimsService.create(
        {
          supplierId: input.supplierId,
          receiptId: input.receiptId,
          branchId: input.branchId,
          claimType,
          title: `Discrepancias en recepción ${input.receiptNumber}`,
          description: descriptionLines.join('\n'),
          amountUsd: +amountUsd.toFixed(4),
        },
        input.userId,
      );
      this.logger.log(
        `[receipt ${input.receiptNumber}] Reclamo auto-generado ${claim.claimNumber} (tipo: ${claimType}, monto: $${amountUsd.toFixed(2)})`,
      );
      return { id: claim.id, claimNumber: claim.claimNumber };
    } catch (err) {
      // No falla la recepción si el claim no se puede crear — solo loggeamos.
      this.logger.error(`[receipt ${input.receiptNumber}] No se pudo auto-generar reclamo: ${(err as Error).message}`);
      return null;
    }
  }

  /**
   * Lista los productos recibidos en una recepción que NO tienen precio de venta
   * vigente (ni global ni override por la sucursal del receipt). Usado por la UI
   * post-recepción para empujar al operador a fijar precios en el módulo de Precios
   * antes de seguir.
   *
   * Una sola query con NOT EXISTS subselect — performante incluso con muchos items.
   */
  async findUnpricedProductsByReceipt(receiptId: string): Promise<
    Array<{
      productId: string;
      productName: string;
      productSku: string | null;
      branchId: string;
      unitCostUsd: number;
      receivedAt: Date;
    }>
  > {
    const receipt = await this.receiptRepo.findOne({ where: { id: receiptId } });
    if (!receipt) throw new NotFoundException('Recepción no encontrada');

    const rows = await this.receiptItemRepo
      .createQueryBuilder('ri')
      .innerJoin(ProductEntity, 'p', 'p.id = ri.product_id')
      .select('ri.product_id', 'productId')
      .addSelect('COALESCE(p.short_name, p.description)', 'productName')
      .addSelect('p.internal_code', 'productSku')
      .addSelect('MAX(ri.unit_cost_usd)', 'unitCostUsd')
      .addSelect('MAX(ri.created_at)', 'receivedAt')
      .where('ri.receipt_id = :receiptId', { receiptId })
      .andWhere('ri.quantity > 0')
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM prices pr
          WHERE pr.product_id = ri.product_id
            AND (pr.branch_id IS NULL OR pr.branch_id = :branchId)
            AND pr.effective_from <= NOW()
            AND (pr.effective_to IS NULL OR pr.effective_to > NOW())
        )`,
        { branchId: receipt.branchId },
      )
      .groupBy('ri.product_id, p.short_name, p.description, p.internal_code')
      .orderBy('MAX(ri.created_at)', 'DESC')
      .getRawMany<{
        productId: string;
        productName: string;
        productSku: string | null;
        unitCostUsd: string;
        receivedAt: Date;
      }>();

    return rows.map((r) => ({
      productId: r.productId,
      productName: r.productName,
      productSku: r.productSku,
      branchId: receipt.branchId,
      unitCostUsd: Number(r.unitCostUsd),
      receivedAt: r.receivedAt,
    }));
  }
}
