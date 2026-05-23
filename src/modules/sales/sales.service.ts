import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, DataSource, EntityManager } from 'typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { ExchangeRatesService } from '@/modules/exchange-rates/exchange-rates.service';
import { SaleTicketEntity } from './infrastructure/persistence/relational/entities/sale-ticket.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';
import { SaleTicketItemEntity } from './infrastructure/persistence/relational/entities/sale-ticket-item.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { SaleTicketPaymentEntity } from './infrastructure/persistence/relational/entities/sale-ticket-payment.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { TerminalTicketCounterEntity } from './infrastructure/persistence/relational/entities/terminal-ticket-counter.entity';
import { CashSessionEntity } from '@/modules/cash-sessions/infrastructure/persistence/relational/entities/cash-session.entity';
import { PrescriptionEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription.entity';
import { CashMovementEntity } from '@/modules/cash-sessions/infrastructure/persistence/relational/entities/cash-movement.entity';
import { PrescriptionItemEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription-item.entity';
import {
  QueryPaymentsDto,
  VoidSaleTicketDto,
  QuerySaleTicketDto,
  CreateSaleTicketDto,
  CreateSaleReturnDto,
  CreateSaleTicketItemDto,
} from './dto';

const IGTF_RATE = 0.03;
const FX_METHODS = new Set(['EFECTIVO_USD', 'ZELLE']);
const VAT_BY_TAX_TYPE: Record<string, number> = {
  exempt: 0,
  exento: 0,
  general: 0.16,
  reduced: 0.08,
};

interface ItemCalc {
  dto: CreateSaleTicketItemDto;
  product: ProductEntity;
  vatRate: number;
  unitPriceUsd: number;
  effectiveUnit: number;
  lineSubtotal: number;
  lineSubtotalExempt: number;
  lineSubtotalTaxable: number;
  lineVat: number;
  lineTotal: number;
  lotId: string | null;
}

@Injectable()
export class SalesService {
  constructor(
    @InjectRepository(SaleTicketEntity)
    private readonly ticketRepo: Repository<SaleTicketEntity>,
    @InjectRepository(SaleTicketItemEntity)
    private readonly itemRepo: Repository<SaleTicketItemEntity>,
    @InjectRepository(SaleTicketPaymentEntity)
    private readonly paymentRepo: Repository<SaleTicketPaymentEntity>,
    @InjectRepository(TerminalTicketCounterEntity)
    private readonly counterRepo: Repository<TerminalTicketCounterEntity>,
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(KardexEntity)
    private readonly kardexRepo: Repository<KardexEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    @InjectRepository(CashSessionEntity)
    private readonly cashSessionRepo: Repository<CashSessionEntity>,
    @InjectRepository(CashMovementEntity)
    private readonly cashMovementRepo: Repository<CashMovementEntity>,
    @InjectRepository(PrescriptionItemEntity)
    private readonly prescriptionItemRepo: Repository<PrescriptionItemEntity>,
    @InjectRepository(PrescriptionEntity)
    private readonly prescriptionRepo: Repository<PrescriptionEntity>,
    private readonly dataSource: DataSource,
    private readonly exchangeRatesService: ExchangeRatesService,
  ) {}

  /**
   * Factor de revaluación vigente (REPOSICION/BCV). 1.0 si modo reposición
   * inactivo. El POS aplica este factor al precio publicado del lote para
   * obtener el monto que cobra al cliente; el ticket persiste el `unit_price`
   * ya con el factor aplicado para que la contabilidad refleje la transacción
   * real.
   */
  private async resolveRevaluationFactor(): Promise<number> {
    const [bcv, rep] = await Promise.all([
      this.exchangeRatesService.getLatest('USD', 'VES', 'BCV'),
      this.exchangeRatesService.getLatest('USD', 'VES', 'REPOSICION'),
    ]);
    const bcvRate = bcv ? Number(bcv.rate) : null;
    const repRate = rep ? Number(rep.rate) : null;
    if (!bcvRate || !repRate || bcvRate <= 0 || repRate <= bcvRate) return 1.0;
    return +(repRate / bcvRate).toFixed(6);
  }

  // ─────────────────────────────────────────────────────────────────
  // Public API

  async create(dto: CreateSaleTicketDto, userId: string, idempotencyKey?: string | null): Promise<SaleTicketEntity> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Validar cash_session abierta y match con terminal/branch.
      const cashSession = await manager.getRepository(CashSessionEntity).findOne({ where: { id: dto.cashSessionId } });
      if (!cashSession) throw new NotFoundException('Sesión de caja no encontrada');
      if (cashSession.status !== 'open') {
        throw new BadRequestException('La sesión de caja no está abierta');
      }
      if (cashSession.terminalId !== dto.terminalId) {
        throw new BadRequestException('La sesión no pertenece al terminal indicado');
      }
      if (cashSession.branchId !== dto.branchId) {
        throw new BadRequestException('La sucursal no coincide con la sesión');
      }

      // 2. Cargar y validar productos.
      const productIds = dto.items.map((i) => i.productId);
      const products = await manager.getRepository(ProductEntity).find({
        where: productIds.map((id) => ({ id })),
      });
      if (products.length !== new Set(productIds).size) {
        throw new BadRequestException('Uno o más productos no existen');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      // 3. Validar récipes para items que requieren.
      await this.validatePrescriptions(manager, dto.items, productMap);

      // 4. Calcular líneas + reservar lotes FEFO. El factor de reposición se
      // resuelve UNA vez por ticket para que todas las líneas usen el mismo
      // multiplicador, evitando inconsistencias si la tasa cambia en medio.
      const revaluationFactor = await this.resolveRevaluationFactor();
      const itemCalcs: ItemCalc[] = [];
      for (const itemDto of dto.items) {
        const product = productMap.get(itemDto.productId)!;
        const calc = await this.calculateAndReserveLine(manager, itemDto, product, dto.branchId, revaluationFactor);
        itemCalcs.push(calc);
      }

      // 5. Sumar totales.
      const subtotalExempt = round4(itemCalcs.reduce((s, c) => s + c.lineSubtotalExempt, 0));
      const subtotalTaxable = round4(itemCalcs.reduce((s, c) => s + c.lineSubtotalTaxable, 0));
      const vatAmount = round4(itemCalcs.reduce((s, c) => s + c.lineVat, 0));
      const subtotalUsd = round4(subtotalExempt + subtotalTaxable + vatAmount);

      // 6. IGTF sobre pagos en divisas.
      const fxPaid = dto.payments
        .filter((p) => FX_METHODS.has(p.paymentMethod))
        .reduce((s, p) => s + Number(p.amountUsd), 0);
      const igtfAmount = round4(fxPaid * IGTF_RATE);
      const totalUsd = round4(subtotalUsd + igtfAmount);
      const totalPaid = round4(dto.payments.reduce((s, p) => s + Number(p.amountUsd), 0));

      if (totalPaid + 0.001 < totalUsd) {
        throw new BadRequestException(`Pago insuficiente: total ${totalUsd}, pagado ${totalPaid}`);
      }
      const changeUsd = round4(totalPaid - totalUsd);

      // 7. Asignar ticket_number atómicamente.
      const ticketNumber = await this.assignTicketNumber(manager, dto.terminalId);

      // 8. Insertar ticket + items + payments.
      const ticket = manager.create(SaleTicketEntity, {
        clientUuid: dto.clientUuid,
        idempotencyKey: idempotencyKey ?? null,
        ticketNumber,
        cashSessionId: dto.cashSessionId,
        terminalId: dto.terminalId,
        branchId: dto.branchId,
        customerId: dto.customerId ?? null,
        salespersonUserId: userId,
        status: 'finalized',
        type: 'sale',
        subtotalExemptUsd: subtotalExempt,
        subtotalTaxableUsd: subtotalTaxable,
        vatAmountUsd: vatAmount,
        igtfAmountUsd: igtfAmount,
        totalUsd,
        totalPaidUsd: totalPaid,
        changeUsd,
        exchangeRateUsdBs: dto.exchangeRateUsdBs,
        totalBs: round2(totalUsd * dto.exchangeRateUsdBs),
        clientCreatedAt: dto.clientCreatedAt ? new Date(dto.clientCreatedAt) : null,
      });
      const savedTicket = await manager.save(ticket);

      const itemEntities = itemCalcs.map((c, idx) =>
        manager.create(SaleTicketItemEntity, {
          saleTicketId: savedTicket.id,
          lineNumber: idx + 1,
          productId: c.product.id,
          lotId: c.lotId,
          productSku: c.product.ean ?? c.product.internalCode ?? c.product.id.slice(0, 8),
          productName: c.product.shortName ?? c.product.description,
          unitPriceUsd: c.unitPriceUsd,
          vatRate: c.vatRate,
          discountPercent: c.dto.discountPercent ?? 0,
          quantity: c.dto.quantity,
          lineSubtotalExemptUsd: round4(c.lineSubtotalExempt),
          lineSubtotalTaxableUsd: round4(c.lineSubtotalTaxable),
          lineVatUsd: round4(c.lineVat),
          lineTotalUsd: round4(c.lineTotal),
          requiresRx: c.product.requiresRecipe,
          prescriptionItemId: c.dto.prescriptionItemId ?? null,
        }),
      );
      await manager.save(itemEntities);

      const paymentEntities = dto.payments.map((p) => {
        const amountBs = resolveAmountBs(p, dto.exchangeRateUsdBs);
        return manager.create(SaleTicketPaymentEntity, {
          saleTicketId: savedTicket.id,
          paymentMethod: p.paymentMethod,
          amountUsd: p.amountUsd,
          amountBs,
          exchangeRateUsed: dto.exchangeRateUsdBs,
          isFx: FX_METHODS.has(p.paymentMethod),
          referenceNumber: p.referenceNumber ?? null,
          cardLast4: p.cardLast4 ?? null,
        });
      });
      await manager.save(paymentEntities);

      // 9. Emitir kardex y actualizar lotes.
      for (const c of itemCalcs) {
        if (!c.lotId) continue;
        await this.emitKardexOut(manager, {
          productId: c.product.id,
          branchId: dto.branchId,
          lotId: c.lotId,
          quantity: c.dto.quantity,
          unitCostUsd: null,
          referenceId: savedTicket.id,
          referenceType: 'sale_ticket',
          userId,
          terminalId: dto.terminalId,
          notes: `Venta #${ticketNumber}`,
        });
      }

      // 10. Asentar cash_movements por cada pago.
      for (const p of dto.payments) {
        await manager.save(
          manager.create(CashMovementEntity, {
            cashSessionId: dto.cashSessionId,
            type: 'sale',
            paymentMethod: p.paymentMethod,
            amountUsd: p.amountUsd,
            amountBs: resolveAmountBs(p, dto.exchangeRateUsdBs),
            exchangeRateUsed: dto.exchangeRateUsdBs,
            referenceId: savedTicket.id,
            referenceType: 'sale_ticket',
            createdByUserId: userId,
            notes: `Venta #${ticketNumber}`,
          }),
        );
      }

      // 11. Actualizar dispensación de récipes.
      await this.updatePrescriptionDispense(manager, itemCalcs);

      return manager.findOneOrFail(SaleTicketEntity, {
        where: { id: savedTicket.id },
        relations: ['items', 'items.product', 'payments', 'customer', 'cashSession'],
      });
    });
  }

  async void(id: string, dto: VoidSaleTicketDto, userId: string): Promise<SaleTicketEntity> {
    return this.dataSource.transaction(async (manager) => {
      const ticket = await manager.findOne(SaleTicketEntity, {
        where: { id },
        relations: ['items', 'payments'],
      });
      if (!ticket) throw new NotFoundException('Ticket no encontrado');
      if (ticket.status === 'voided') {
        throw new ConflictException('El ticket ya está anulado');
      }

      // Reversar stock por cada item con lot.
      for (const item of ticket.items) {
        if (!item.lotId) continue;
        const lot = await manager.findOneOrFail(InventoryLotEntity, {
          where: { id: item.lotId },
        });
        const qty = Number(item.quantity);
        lot.quantityAvailable = +(Number(lot.quantityAvailable) + qty).toFixed(3);
        lot.quantitySold = +(Number(lot.quantitySold) - qty).toFixed(3);
        await manager.save(lot);

        await this.emitKardexIn(manager, {
          productId: item.productId,
          branchId: ticket.branchId,
          lotId: lot.id,
          quantity: qty,
          unitCostUsd: null,
          referenceId: ticket.id,
          referenceType: 'sale_ticket_void',
          userId,
          terminalId: ticket.terminalId,
          notes: `Anulación venta #${ticket.ticketNumber}: ${dto.reason}`,
        });
      }

      // Asentar movements de adjustment negativos por cada pago.
      for (const p of ticket.payments) {
        await manager.save(
          manager.create(CashMovementEntity, {
            cashSessionId: ticket.cashSessionId,
            type: 'adjustment',
            paymentMethod: p.paymentMethod,
            amountUsd: -Number(p.amountUsd),
            amountBs: -Number(p.amountBs),
            exchangeRateUsed: p.exchangeRateUsed ?? null,
            referenceId: ticket.id,
            referenceType: 'sale_ticket_void',
            createdByUserId: userId,
            notes: `Anulación venta #${ticket.ticketNumber}: ${dto.reason}`,
          }),
        );
      }

      // Reversar dispensación de récipes.
      for (const item of ticket.items) {
        if (!item.prescriptionItemId) continue;
        const presItem = await manager.findOneOrFail(PrescriptionItemEntity, {
          where: { id: item.prescriptionItemId },
        });
        presItem.quantityDispensed = Math.max(
          0,
          +(Number(presItem.quantityDispensed) - Number(item.quantity)).toFixed(3),
        );
        await manager.save(presItem);
        await this.recomputePrescriptionStatus(manager, presItem.prescriptionId);
      }

      ticket.status = 'voided';
      ticket.voidedAt = new Date();
      ticket.voidedByUserId = userId;
      ticket.voidReason = dto.reason;
      await manager.save(ticket);

      return manager.findOneOrFail(SaleTicketEntity, {
        where: { id },
        relations: ['items', 'payments', 'customer'],
      });
    });
  }

  async findOne(id: string): Promise<SaleTicketEntity> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: ['items', 'items.product', 'payments', 'customer', 'cashSession', 'terminal', 'branch'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async findByTicketNumber(terminalId: string, ticketNumber: number): Promise<SaleTicketEntity> {
    const ticket = await this.ticketRepo.findOne({
      where: { terminalId, ticketNumber },
      relations: ['items', 'items.product', 'payments', 'customer'],
    });
    if (!ticket) throw new NotFoundException('Ticket no encontrado');
    return ticket;
  }

  async findAll(query: QuerySaleTicketDto): Promise<{
    data: SaleTicketEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Record<string, unknown> = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.terminalId) where.terminalId = query.terminalId;
    if (query.cashSessionId) where.cashSessionId = query.cashSessionId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.status) where.status = query.status;
    if (query.type) where.type = query.type;
    if (query.from && query.to) {
      where.createdAt = Between(new Date(query.from), new Date(query.to));
    }

    const [data, total] = await this.ticketRepo.findAndCount({
      where,
      relations: ['customer', 'terminal', 'branch'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────
  // Reportes financieros

  /**
   * Listado paginado de pagos con filtros por rango/branch/terminal/método.
   * Devuelve también un resumen agregado por método para que el dueño
   * concilie contra extractos bancarios.
   */
  async findPayments(query: QueryPaymentsDto): Promise<{
    data: Array<{
      paymentId: string;
      ticketId: string;
      ticketNumber: number;
      ticketType: 'sale' | 'return';
      ticketStatus: 'finalized' | 'voided';
      paymentMethod: string;
      amountUsd: number;
      amountBs: number;
      exchangeRateUsed: number | null;
      referenceNumber: string | null;
      cardLast4: string | null;
      createdAt: Date;
      branchId: string;
      branchName: string | null;
      terminalId: string;
      terminalCode: string | null;
      customerId: string | null;
      customerName: string | null;
    }>;
    summary: Array<{
      paymentMethod: string;
      count: number;
      totalUsd: number;
      totalBs: number;
    }>;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 50;

    const qb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.saleTicket', 't')
      .leftJoinAndSelect('t.branch', 'b')
      .leftJoinAndSelect('t.terminal', 'term')
      .leftJoinAndSelect('t.customer', 'c');

    if (query.from && query.to) {
      qb.andWhere('p.created_at BETWEEN :from AND :to', {
        from: new Date(query.from),
        to: new Date(query.to),
      });
    } else if (query.from) {
      qb.andWhere('p.created_at >= :from', { from: new Date(query.from) });
    } else if (query.to) {
      qb.andWhere('p.created_at <= :to', { to: new Date(query.to) });
    }
    if (query.branchId) qb.andWhere('t.branch_id = :bid', { bid: query.branchId });
    if (query.terminalId) qb.andWhere('t.terminal_id = :tid', { tid: query.terminalId });
    if (query.paymentMethod) qb.andWhere('p.payment_method = :pm', { pm: query.paymentMethod });

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      // TypeORM resuelve `alias.property` por la entity (camelCase), no por
      // nombre de columna SQL. Con `p.created_at` la metadata column no se
      // encuentra y TypeORM revienta con "Cannot read properties of undefined
      // (reading 'databaseName')". Para `andWhere` con string raw sí funciona
      // snake_case porque TypeORM lo pasa directo al SQL sin validar.
      .orderBy('p.createdAt', 'DESC')
      .getManyAndCount();

    const data = rows.map((p) => ({
      paymentId: p.id,
      ticketId: p.saleTicket.id,
      ticketNumber: p.saleTicket.ticketNumber,
      ticketType: p.saleTicket.type,
      ticketStatus: p.saleTicket.status,
      paymentMethod: p.paymentMethod,
      amountUsd: Number(p.amountUsd),
      amountBs: Number(p.amountBs),
      exchangeRateUsed: p.exchangeRateUsed === null ? null : Number(p.exchangeRateUsed),
      referenceNumber: p.referenceNumber,
      cardLast4: p.cardLast4,
      createdAt: p.createdAt,
      branchId: p.saleTicket.branchId,
      branchName: p.saleTicket.branch?.name ?? null,
      terminalId: p.saleTicket.terminalId,
      terminalCode: p.saleTicket.terminal?.code ?? null,
      customerId: p.saleTicket.customerId,
      customerName: p.saleTicket.customer?.fullName ?? null,
    }));

    // Resumen agregado por método dentro del mismo filtro (sin paginar).
    const summaryQb = this.paymentRepo
      .createQueryBuilder('p')
      .leftJoin('p.saleTicket', 't')
      .select('p.payment_method', 'paymentMethod')
      .addSelect('COUNT(*)::int', 'count')
      .addSelect('COALESCE(SUM(p.amount_usd), 0)', 'totalUsd')
      .addSelect('COALESCE(SUM(p.amount_bs), 0)', 'totalBs')
      .groupBy('p.payment_method');
    if (query.from && query.to) {
      summaryQb.andWhere('p.created_at BETWEEN :from AND :to', {
        from: new Date(query.from),
        to: new Date(query.to),
      });
    } else if (query.from) {
      summaryQb.andWhere('p.created_at >= :from', { from: new Date(query.from) });
    } else if (query.to) {
      summaryQb.andWhere('p.created_at <= :to', { to: new Date(query.to) });
    }
    if (query.branchId) summaryQb.andWhere('t.branch_id = :bid', { bid: query.branchId });
    if (query.terminalId) summaryQb.andWhere('t.terminal_id = :tid', { tid: query.terminalId });
    if (query.paymentMethod) summaryQb.andWhere('p.payment_method = :pm', { pm: query.paymentMethod });
    const summaryRaw = await summaryQb.getRawMany<{
      paymentMethod: string;
      count: number | string;
      totalUsd: number | string;
      totalBs: number | string;
    }>();
    const summary = summaryRaw.map((r) => ({
      paymentMethod: r.paymentMethod,
      count: Number(r.count),
      totalUsd: Number(r.totalUsd),
      totalBs: Number(r.totalBs),
    }));

    return { data, summary, total, page, limit };
  }

  // ─────────────────────────────────────────────────────────────────
  // Devoluciones (parciales o totales)

  /**
   * Crea una nota de crédito (sale_ticket type='return') sobre un ticket
   * original `finalized`. Reversa stock, kardex y dispensaciones de récipe,
   * y asienta cash_movements type='return' con montos NEGATIVOS (sale dinero
   * de la caja al cliente).
   *
   * - Permitido devolver parcial; queda historial sumable contra el original.
   * - No se puede devolver más de lo originalmente vendido menos lo ya devuelto.
   * - Recibe `refunds` con los montos por método (cómo se reembolsa al cliente).
   */
  async createReturn(
    dto: CreateSaleReturnDto,
    userId: string,
    idempotencyKey?: string | null,
  ): Promise<SaleTicketEntity> {
    return this.dataSource.transaction(async (manager) => {
      // 1. Cargar ticket original (con items + payments) y validar estado.
      const original = await manager.findOne(SaleTicketEntity, {
        where: { id: dto.referenceTicketId },
        relations: ['items', 'items.lot', 'items.product', 'payments'],
      });
      if (!original) throw new NotFoundException('Ticket original no encontrado');
      if (original.status !== 'finalized') {
        throw new BadRequestException(`El ticket original no es facturable (status=${original.status})`);
      }
      if (original.type !== 'sale') {
        throw new BadRequestException('Sólo se puede devolver sobre un ticket de venta');
      }

      // 2. Validar sesión de caja abierta para el terminal/sucursal.
      const cashSession = await manager.findOne(CashSessionEntity, {
        where: { id: dto.cashSessionId },
      });
      if (!cashSession) throw new NotFoundException('Sesión de caja no encontrada');
      if (cashSession.status !== 'open') {
        throw new BadRequestException('La sesión de caja no está abierta');
      }
      if (cashSession.terminalId !== dto.terminalId) {
        throw new BadRequestException('La sesión no pertenece al terminal indicado');
      }

      // 3. Pre-cargar cantidades ya devueltas por item (todas las return
      // tickets previas que referencian este original).
      const previousReturns = await manager.find(SaleTicketEntity, {
        where: { referenceTicketId: original.id, type: 'return', status: 'finalized' },
        relations: ['items'],
      });
      const alreadyReturned: Record<string, number> = {};
      for (const prev of previousReturns) {
        for (const it of prev.items ?? []) {
          // Cada item de devolución previa tiene su propio sale_ticket_item_id,
          // pero apunta al mismo product_id que el item original. Usamos
          // el matching por productId + lotId para acumular.
          const key = `${it.productId}|${it.lotId ?? 'no-lot'}`;
          alreadyReturned[key] = (alreadyReturned[key] ?? 0) + Number(it.quantity);
        }
      }

      // 4. Validar cada item y reversar stock.
      type ReturnItemCalc = {
        originalItem: SaleTicketItemEntity;
        quantity: number;
        lineSubtotalExempt: number;
        lineSubtotalTaxable: number;
        lineVat: number;
        lineTotal: number;
      };

      const calcs: ReturnItemCalc[] = [];
      for (const it of dto.items) {
        const originalItem = original.items.find((oi) => oi.id === it.saleTicketItemId);
        if (!originalItem) {
          throw new BadRequestException(`Item ${it.saleTicketItemId} no pertenece al ticket original`);
        }
        const key = `${originalItem.productId}|${originalItem.lotId ?? 'no-lot'}`;
        const alreadyQty = alreadyReturned[key] ?? 0;
        const remaining = Number(originalItem.quantity) - alreadyQty;
        if (it.quantity - 0.001 > remaining) {
          throw new BadRequestException(
            `No se puede devolver ${it.quantity} del item ${originalItem.productName}; ` +
              `restante ${remaining.toFixed(3)}`,
          );
        }

        const effectiveUnit = Number(originalItem.unitPriceUsd) * (1 - Number(originalItem.discountPercent) / 100);
        const vatRate = Number(originalItem.vatRate);
        const lineSubtotal = effectiveUnit * it.quantity;
        const lineSubtotalExempt = vatRate === 0 ? lineSubtotal : 0;
        const lineSubtotalTaxable = vatRate > 0 ? lineSubtotal : 0;
        const lineVat = lineSubtotalTaxable * vatRate;
        const lineTotal = lineSubtotalExempt + lineSubtotalTaxable + lineVat;

        // Reversar lote: increment available, decrement sold.
        if (originalItem.lotId) {
          const lot = await manager.findOne(InventoryLotEntity, {
            where: { id: originalItem.lotId },
          });
          if (lot) {
            lot.quantityAvailable = +(Number(lot.quantityAvailable) + it.quantity).toFixed(3);
            lot.quantitySold = +(Number(lot.quantitySold) - it.quantity).toFixed(3);
            await manager.save(lot);

            await this.emitKardexIn(manager, {
              productId: originalItem.productId,
              branchId: dto.branchId,
              lotId: lot.id,
              quantity: it.quantity,
              unitCostUsd: null,
              referenceId: original.id,
              referenceType: 'sale_ticket_return',
              userId,
              terminalId: dto.terminalId,
              notes: `Devolución sobre ticket #${original.ticketNumber}`,
            });
          }
        }

        // Decrementar dispensación de récipe si aplica.
        if (originalItem.prescriptionItemId) {
          const presItem = await manager.findOne(PrescriptionItemEntity, {
            where: { id: originalItem.prescriptionItemId },
          });
          if (presItem) {
            presItem.quantityDispensed = Math.max(0, +(Number(presItem.quantityDispensed) - it.quantity).toFixed(3));
            await manager.save(presItem);
            await this.recomputePrescriptionStatus(manager, presItem.prescriptionId);
          }
        }

        calcs.push({
          originalItem,
          quantity: it.quantity,
          lineSubtotalExempt,
          lineSubtotalTaxable,
          lineVat,
          lineTotal,
        });
      }

      // 5. Totales del ticket de devolución (positivos, informativos).
      const subtotalExempt = round4(calcs.reduce((s, c) => s + c.lineSubtotalExempt, 0));
      const subtotalTaxable = round4(calcs.reduce((s, c) => s + c.lineSubtotalTaxable, 0));
      const vatAmount = round4(calcs.reduce((s, c) => s + c.lineVat, 0));
      const subtotalUsd = round4(subtotalExempt + subtotalTaxable + vatAmount);

      // 6. IGTF de los refunds en divisas (se reembolsa también el IGTF).
      const fxRefunded = dto.refunds
        .filter((r) => FX_METHODS.has(r.paymentMethod))
        .reduce((s, r) => s + Number(r.amountUsd), 0);
      const igtfAmount = round4(fxRefunded * IGTF_RATE);
      const totalUsd = round4(subtotalUsd + igtfAmount);
      const totalRefunded = round4(dto.refunds.reduce((s, r) => s + Number(r.amountUsd), 0));

      // Permitimos pequeña tolerancia para diferencias por redondeo.
      if (Math.abs(totalRefunded - totalUsd) > 0.01) {
        throw new BadRequestException(
          `Refund total (${totalRefunded}) no coincide con el valor devuelto (${totalUsd})`,
        );
      }

      // 7. Asignar ticket_number para la nota de crédito.
      const ticketNumber = await this.assignTicketNumber(manager, dto.terminalId);

      // 8. Insertar sale_ticket type='return'.
      const ticket = manager.create(SaleTicketEntity, {
        clientUuid: dto.clientUuid,
        idempotencyKey: idempotencyKey ?? null,
        ticketNumber,
        cashSessionId: dto.cashSessionId,
        terminalId: dto.terminalId,
        branchId: dto.branchId,
        customerId: original.customerId,
        salespersonUserId: userId,
        status: 'finalized',
        type: 'return',
        referenceTicketId: original.id,
        subtotalExemptUsd: subtotalExempt,
        subtotalTaxableUsd: subtotalTaxable,
        vatAmountUsd: vatAmount,
        igtfAmountUsd: igtfAmount,
        totalUsd,
        totalPaidUsd: totalRefunded,
        changeUsd: 0,
        exchangeRateUsdBs: dto.exchangeRateUsdBs,
        totalBs: round2(totalUsd * dto.exchangeRateUsdBs),
        clientCreatedAt: dto.clientCreatedAt ? new Date(dto.clientCreatedAt) : null,
        voidReason: dto.reason ?? null,
      });
      const savedTicket = await manager.save(ticket);

      // 9. Insertar items (cantidades positivas, snapshot del original).
      const itemEntities = calcs.map((c, idx) =>
        manager.create(SaleTicketItemEntity, {
          saleTicketId: savedTicket.id,
          lineNumber: idx + 1,
          productId: c.originalItem.productId,
          lotId: c.originalItem.lotId,
          productSku: c.originalItem.productSku,
          productName: c.originalItem.productName,
          unitPriceUsd: c.originalItem.unitPriceUsd,
          vatRate: c.originalItem.vatRate,
          discountPercent: c.originalItem.discountPercent,
          quantity: c.quantity,
          lineSubtotalExemptUsd: round4(c.lineSubtotalExempt),
          lineSubtotalTaxableUsd: round4(c.lineSubtotalTaxable),
          lineVatUsd: round4(c.lineVat),
          lineTotalUsd: round4(c.lineTotal),
          requiresRx: c.originalItem.requiresRx,
          prescriptionItemId: c.originalItem.prescriptionItemId,
        }),
      );
      await manager.save(itemEntities);

      // 10. Insertar refunds como sale_ticket_payments con monto NEGATIVO
      // para reflejar salida de dinero hacia el cliente.
      const paymentEntities = dto.refunds.map((r) =>
        manager.create(SaleTicketPaymentEntity, {
          saleTicketId: savedTicket.id,
          paymentMethod: r.paymentMethod,
          amountUsd: -Math.abs(Number(r.amountUsd)),
          amountBs: -Math.abs(resolveAmountBs(r, dto.exchangeRateUsdBs)),
          exchangeRateUsed: dto.exchangeRateUsdBs,
          isFx: FX_METHODS.has(r.paymentMethod),
          referenceNumber: r.referenceNumber ?? null,
        }),
      );
      await manager.save(paymentEntities);

      // 11. Cash movements type='return' con montos NEGATIVOS.
      for (const r of dto.refunds) {
        await manager.save(
          manager.create(CashMovementEntity, {
            cashSessionId: dto.cashSessionId,
            type: 'return',
            paymentMethod: r.paymentMethod,
            amountUsd: -Math.abs(Number(r.amountUsd)),
            amountBs: -Math.abs(resolveAmountBs(r, dto.exchangeRateUsdBs)),
            exchangeRateUsed: dto.exchangeRateUsdBs,
            referenceId: savedTicket.id,
            referenceType: 'sale_ticket_return',
            createdByUserId: userId,
            notes: `Devolución NC #${ticketNumber} sobre venta #${original.ticketNumber}${dto.reason ? ` — ${dto.reason}` : ''}`,
          }),
        );
      }

      return manager.findOneOrFail(SaleTicketEntity, {
        where: { id: savedTicket.id },
        relations: ['items', 'items.product', 'payments', 'customer', 'cashSession', 'referenceTicket'],
      });
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Helpers privados

  private async assignTicketNumber(manager: EntityManager, terminalId: string): Promise<number> {
    // Asegurar fila del counter (insert si no existe).
    await manager.query(
      `INSERT INTO terminal_ticket_counters (terminal_id, last_number)
       VALUES ($1, 0) ON CONFLICT (terminal_id) DO NOTHING`,
      [terminalId],
    );
    const raw = await manager.query(
      `UPDATE terminal_ticket_counters
       SET last_number = last_number + 1, updated_at = now()
       WHERE terminal_id = $1
       RETURNING last_number`,
      [terminalId],
    );
    // TypeORM/pg pueden devolver `[rows, count]` (tupla) o `rows[]` directo
    // según versión/driver. Normalizamos para extraer el primer row.
    const rows: Array<{ last_number: number | string }> = Array.isArray(raw?.[0]) ? raw[0] : raw;
    const value = rows?.[0]?.last_number;
    const parsed = typeof value === 'string' ? parseInt(value, 10) : Number(value);
    if (!Number.isFinite(parsed)) {
      throw new Error(`No se pudo asignar ticket_number para terminal ${terminalId} (raw=${JSON.stringify(raw)})`);
    }
    return parsed;
  }

  private async calculateAndReserveLine(
    manager: EntityManager,
    itemDto: CreateSaleTicketItemDto,
    product: ProductEntity,
    branchId: string,
    revaluationFactor: number,
  ): Promise<ItemCalc> {
    // Tomar precio del lote más viejo no vencido + cantidad disponible >= solicitada.
    // Usamos SELECT FOR UPDATE para serializar contra otras transacciones.
    const candidateLots = await manager
      .getRepository(InventoryLotEntity)
      .createQueryBuilder('lot')
      .setLock('pessimistic_write')
      .where('lot.product_id = :pid', { pid: product.id })
      .andWhere('lot.branch_id = :bid', { bid: branchId })
      .andWhere("lot.status = 'available'")
      .andWhere('lot.quantity_available >= :qty', { qty: itemDto.quantity })
      .andWhere('(lot.expiration_date IS NULL OR lot.expiration_date > now())')
      .orderBy('lot.expiration_date', 'ASC')
      .limit(1)
      .getOne();

    if (!candidateLots) {
      throw new BadRequestException(
        `Sin stock suficiente para "${product.shortName ?? product.description}" en esta sucursal`,
      );
    }

    // El precio publicado del lote es el "principal" (SUNDDE). Aplicamos el
    // factor de reposición para obtener el precio que efectivamente se cobra.
    // Si el factor es 1.0 (modo reposición OFF), unitPriceUsd == salePrice del lote.
    const basePriceUsd = Number(candidateLots.salePrice);
    const unitPriceUsd = +(basePriceUsd * revaluationFactor).toFixed(4);
    const vatRate = VAT_BY_TAX_TYPE[product.taxType] ?? 0.16;
    const discountPercent = itemDto.discountPercent ?? 0;
    const effectiveUnit = unitPriceUsd * (1 - discountPercent / 100);
    const lineSubtotal = effectiveUnit * itemDto.quantity;
    const lineSubtotalExempt = vatRate === 0 ? lineSubtotal : 0;
    const lineSubtotalTaxable = vatRate > 0 ? lineSubtotal : 0;
    const lineVat = lineSubtotalTaxable * vatRate;
    const lineTotal = lineSubtotalExempt + lineSubtotalTaxable + lineVat;

    // Reservar (decrementar disponible, aumentar vendido).
    candidateLots.quantityAvailable = +(Number(candidateLots.quantityAvailable) - itemDto.quantity).toFixed(3);
    candidateLots.quantitySold = +(Number(candidateLots.quantitySold) + itemDto.quantity).toFixed(3);
    await manager.save(candidateLots);

    return {
      dto: itemDto,
      product,
      vatRate,
      unitPriceUsd,
      effectiveUnit,
      lineSubtotal,
      lineSubtotalExempt,
      lineSubtotalTaxable,
      lineVat,
      lineTotal,
      lotId: candidateLots.id,
    };
  }

  private async emitKardexOut(
    manager: EntityManager,
    args: {
      productId: string;
      branchId: string;
      lotId: string;
      quantity: number;
      unitCostUsd: number | null;
      referenceId: string;
      referenceType: string;
      userId: string;
      terminalId: string;
      notes: string;
    },
  ): Promise<void> {
    const totalRow = await manager
      .getRepository(InventoryLotEntity)
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.quantity_available), 0)', 'total')
      .where('l.product_id = :pid', { pid: args.productId })
      .andWhere('l.branch_id = :bid', { bid: args.branchId })
      .andWhere("l.status = 'available'")
      .getRawOne<{ total: string }>();
    const balance = parseFloat(totalRow?.total ?? '0') || 0;

    await manager.save(
      manager.create(KardexEntity, {
        productId: args.productId,
        branchId: args.branchId,
        lotId: args.lotId,
        movementType: 'sale',
        quantity: -Math.abs(args.quantity),
        unitCostUsd: args.unitCostUsd,
        balanceAfter: +balance.toFixed(3),
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        userId: args.userId,
        terminalId: args.terminalId,
        notes: args.notes,
      }),
    );
  }

  private async emitKardexIn(
    manager: EntityManager,
    args: {
      productId: string;
      branchId: string;
      lotId: string;
      quantity: number;
      unitCostUsd: number | null;
      referenceId: string;
      referenceType: string;
      userId: string;
      terminalId: string;
      notes: string;
    },
  ): Promise<void> {
    const totalRow = await manager
      .getRepository(InventoryLotEntity)
      .createQueryBuilder('l')
      .select('COALESCE(SUM(l.quantity_available), 0)', 'total')
      .where('l.product_id = :pid', { pid: args.productId })
      .andWhere('l.branch_id = :bid', { bid: args.branchId })
      .andWhere("l.status = 'available'")
      .getRawOne<{ total: string }>();
    const balance = parseFloat(totalRow?.total ?? '0') || 0;

    await manager.save(
      manager.create(KardexEntity, {
        productId: args.productId,
        branchId: args.branchId,
        lotId: args.lotId,
        movementType: 'return',
        quantity: Math.abs(args.quantity),
        unitCostUsd: args.unitCostUsd,
        balanceAfter: +balance.toFixed(3),
        referenceType: args.referenceType,
        referenceId: args.referenceId,
        userId: args.userId,
        terminalId: args.terminalId,
        notes: args.notes,
      }),
    );
  }

  private async validatePrescriptions(
    manager: EntityManager,
    items: CreateSaleTicketItemDto[],
    productMap: Map<string, ProductEntity>,
  ): Promise<void> {
    for (const item of items) {
      const product = productMap.get(item.productId)!;
      if (!product.requiresRecipe) continue;
      if (!item.prescriptionItemId) {
        throw new BadRequestException(
          `Producto "${product.shortName ?? product.description}" requiere récipe (prescriptionItemId)`,
        );
      }
      const presItem = await manager.findOne(PrescriptionItemEntity, {
        where: { id: item.prescriptionItemId },
        relations: ['prescription'],
      });
      if (!presItem) {
        throw new BadRequestException('Récipe item no encontrado');
      }
      if (presItem.productId !== item.productId) {
        throw new BadRequestException('El récipe item no corresponde al producto solicitado');
      }
      const presc = presItem.prescription;
      if (presc.status === 'cancelled' || presc.status === 'expired') {
        throw new BadRequestException(`Récipe ${presc.status}`);
      }
      if (presc.expiresAt && presc.expiresAt < new Date()) {
        throw new BadRequestException('Récipe vencido');
      }
      const remaining = Number(presItem.quantityPrescribed) - Number(presItem.quantityDispensed);
      if (remaining + 0.001 < item.quantity) {
        throw new BadRequestException(`Cantidad solicitada excede el récipe (restante ${remaining})`);
      }
    }
  }

  private async updatePrescriptionDispense(manager: EntityManager, calcs: ItemCalc[]): Promise<void> {
    for (const c of calcs) {
      if (!c.dto.prescriptionItemId) continue;
      const presItem = await manager.findOneOrFail(PrescriptionItemEntity, {
        where: { id: c.dto.prescriptionItemId },
      });
      presItem.quantityDispensed = +(Number(presItem.quantityDispensed) + Number(c.dto.quantity)).toFixed(3);
      await manager.save(presItem);
      await this.recomputePrescriptionStatus(manager, presItem.prescriptionId);
    }
  }

  private async recomputePrescriptionStatus(manager: EntityManager, prescriptionId: string): Promise<void> {
    const items = await manager.find(PrescriptionItemEntity, {
      where: { prescriptionId },
    });
    const allFull = items.every((i) => Number(i.quantityDispensed) >= Number(i.quantityPrescribed) - 0.001);
    const anyPartial = items.some(
      (i) => Number(i.quantityDispensed) > 0 && Number(i.quantityDispensed) < Number(i.quantityPrescribed),
    );
    const presc = await manager.findOneOrFail(PrescriptionEntity, {
      where: { id: prescriptionId },
    });
    if (presc.status === 'cancelled') return;
    let next = presc.status;
    if (allFull) next = 'fully_dispensed';
    else if (anyPartial) next = 'partially_dispensed';
    else next = 'active';
    if (next !== presc.status) {
      presc.status = next;
      await manager.save(presc);
    }
  }
}

function round4(n: number): number {
  return +n.toFixed(4);
}

function round2(n: number): number {
  return +n.toFixed(2);
}

/**
 * Devuelve el monto en Bs del pago. Si el cliente lo provee (caso ideal),
 * lo respeta tal cual. Si no, lo computa como `amountUsd × tasa` para que
 * los reportes X/Z y los movimientos de caja queden completos en ambas
 * monedas (pago móvil, efectivo Bs, tarjetas). Métodos USD/Zelle pueden
 * dejar `amountBs = 0` ya que la transacción no toca Bs.
 */
function resolveAmountBs(
  payment: { paymentMethod: string; amountUsd: number; amountBs?: number },
  exchangeRate: number,
): number {
  if (payment.amountBs !== undefined && payment.amountBs > 0) {
    return round2(payment.amountBs);
  }
  if (payment.paymentMethod === 'EFECTIVO_USD' || payment.paymentMethod === 'ZELLE') {
    return 0;
  }
  return round2(Number(payment.amountUsd) * exchangeRate);
}
