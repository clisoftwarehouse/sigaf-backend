import { Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Between, Repository, type EntityManager } from 'typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { QueryAccountsPayableDto, CreateAccountsPayableDto } from '../dto';
import { AccountsPayableEntity } from '../infrastructure/persistence/relational/entities/accounts-payable.entity';
import { GoodsReceiptEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';

export type AgingBucket = 'current' | 'overdue_1_30' | 'overdue_31_60' | 'overdue_61_90' | 'overdue_90_plus';

export type AgingSummary = {
  branchId?: string;
  buckets: Record<AgingBucket, { count: number; totalUsd: number }>;
  totalOpenUsd: number;
  totalOpenCount: number;
  totalOverdueUsd: number;
  totalOverdueCount: number;
};

/**
 * CRUD + lectura de CxP. La lógica de pagos vive en PaymentsService.
 *
 * Reglas:
 * - balance_usd y status se actualizan SIEMPRE desde PaymentsService al
 *   registrar/revertir un pago, no aceptamos updates directos.
 * - createFromReceipt corre fuera de la transacción de la recepción:
 *   si falla, no rompe la recepción (solo loggea warning).
 */
@Injectable()
export class AccountsPayableService {
  private readonly logger = new Logger(AccountsPayableService.name);

  constructor(
    @InjectRepository(AccountsPayableEntity)
    private readonly repo: Repository<AccountsPayableEntity>,
    @InjectRepository(GoodsReceiptEntity)
    private readonly receiptRepo: Repository<GoodsReceiptEntity>,
  ) {}

  async findAll(query: QueryAccountsPayableDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(200, Math.max(1, Number(query.limit) || 50));

    const where: Record<string, unknown> = {};
    if (query.branchId) where.branchId = query.branchId;
    if (query.supplierId) where.supplierId = query.supplierId;
    if (query.status) where.status = query.status;
    if (query.fromDate && query.toDate) {
      where.invoiceDate = Between(new Date(query.fromDate), new Date(query.toDate));
    }

    const [rows, total] = await this.repo.findAndCount({
      where,
      relations: ['supplier', 'branch'],
      order: { dueDate: 'ASC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Aging bucket filter (in-memory después de la query — el volumen de CxPs
    // abiertas es bajo, no justifica query complicada).
    let filtered = rows;
    if (query.agingBucket) {
      const today = new Date();
      filtered = rows.filter((r) => this.classifyAging(r.dueDate, r.status, today) === query.agingBucket);
    }

    return {
      data: filtered.map((r) => this.serialize(r)),
      pagination: {
        page,
        limit,
        total: query.agingBucket ? filtered.length : total,
        totalPages: Math.ceil((query.agingBucket ? filtered.length : total) / limit),
      },
    };
  }

  async findOne(id: string) {
    const cxp = await this.repo.findOne({
      where: { id },
      relations: ['supplier', 'branch', 'payments'],
    });
    if (!cxp) throw new NotFoundException('Cuenta por pagar no encontrada');
    // Ordenar pagos por fecha desc.
    if (cxp.payments) {
      cxp.payments.sort((a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime());
    }
    return this.serialize(cxp, true);
  }

  async findOneRaw(id: string, manager?: EntityManager): Promise<AccountsPayableEntity> {
    const repo = manager ? manager.getRepository(AccountsPayableEntity) : this.repo;
    const cxp = await repo.findOne({ where: { id } });
    if (!cxp) throw new NotFoundException('Cuenta por pagar no encontrada');
    return cxp;
  }

  async create(dto: CreateAccountsPayableDto, userId: string): Promise<AccountsPayableEntity> {
    if (Number(dto.originalAmountUsd) <= 0) {
      throw new BadRequestException('El monto debe ser mayor a cero');
    }
    const entity = this.repo.create({
      supplierId: dto.supplierId,
      branchId: dto.branchId,
      sourceReceiptId: dto.sourceReceiptId ?? null,
      invoiceNumber: dto.invoiceNumber ?? null,
      invoiceDate: new Date(dto.invoiceDate),
      dueDate: new Date(dto.dueDate),
      currencyNative: dto.currencyNative,
      originalAmountUsd: Number(dto.originalAmountUsd),
      originalAmountNative: Number(dto.originalAmountNative),
      exchangeRateAtCreation: dto.exchangeRateAtCreation ?? null,
      paidAmountUsd: 0,
      balanceUsd: Number(dto.originalAmountUsd),
      status: 'open',
      paymentTermsDays: dto.paymentTermsDays ?? 30,
      notes: dto.notes ?? null,
      createdBy: userId,
    });
    return this.repo.save(entity);
  }

  /**
   * Llamado desde el hook de createReceipt/reapproveReceipt cuando una
   * recepción queda aprobada. Idempotente: si ya existe una CxP para esa
   * recepción, devuelve la existente.
   */
  async createFromReceipt(receiptId: string, userId: string): Promise<AccountsPayableEntity | null> {
    try {
      const existing = await this.repo.findOne({ where: { sourceReceiptId: receiptId } });
      if (existing) return existing;

      const receipt = await this.receiptRepo.findOne({ where: { id: receiptId } });
      if (!receipt) {
        this.logger.warn(`createFromReceipt: receipt ${receiptId} no encontrada`);
        return null;
      }

      // payment_terms_days no vive en goods_receipts. Default 30 — versiones
      // futuras pueden leerlo de supplier o de drugstore_conditions.
      const paymentTermsDays = 30;
      const receiptDate = receipt.receiptDate instanceof Date ? receipt.receiptDate : new Date(receipt.receiptDate);
      const dueDate = new Date(receiptDate);
      dueDate.setDate(dueDate.getDate() + paymentTermsDays);

      const isVes = receipt.nativeCurrency === 'VES';
      const totalUsd = Number(receipt.totalUsd) || 0;
      const totalNative = isVes ? Number(receipt.nativeTotal) || totalUsd : totalUsd;
      const rate = isVes && receipt.exchangeRateUsed ? Number(receipt.exchangeRateUsed) : null;

      const cxp = this.repo.create({
        supplierId: receipt.supplierId,
        branchId: receipt.branchId,
        sourceReceiptId: receipt.id,
        invoiceNumber: receipt.supplierInvoiceNumber ?? null,
        invoiceDate: receiptDate,
        dueDate,
        currencyNative: isVes ? 'VES' : 'USD',
        originalAmountUsd: totalUsd,
        originalAmountNative: totalNative,
        exchangeRateAtCreation: rate,
        paidAmountUsd: 0,
        balanceUsd: totalUsd,
        status: 'open',
        paymentTermsDays,
        notes: `Generada automáticamente desde recepción ${receipt.receiptNumber}`,
        createdBy: userId,
      });
      return await this.repo.save(cxp);
    } catch (err) {
      // No rompemos el flujo de recepción si CxP falla — sólo loggeamos.
      this.logger.error(`createFromReceipt fallo para receipt=${receiptId}: ${(err as Error).message}`);
      return null;
    }
  }

  async cancel(id: string, reason: string, userId: string): Promise<AccountsPayableEntity> {
    const cxp = await this.findOneRaw(id);
    if (cxp.status === 'cancelled') {
      throw new BadRequestException('La CxP ya está cancelada');
    }
    if (Number(cxp.paidAmountUsd) > 0) {
      throw new BadRequestException('No se puede cancelar una CxP con pagos aplicados. Reverte los pagos primero.');
    }
    cxp.status = 'cancelled';
    cxp.notes = [cxp.notes, `Cancelada por ${userId}: ${reason}`].filter(Boolean).join('\n');
    return this.repo.save(cxp);
  }

  async getAgingSummary(branchId?: string): Promise<AgingSummary> {
    const where: Record<string, unknown> = { status: In(['open', 'partial']) };
    if (branchId) where.branchId = branchId;
    const rows = await this.repo.find({ where });

    const buckets: AgingSummary['buckets'] = {
      current: { count: 0, totalUsd: 0 },
      overdue_1_30: { count: 0, totalUsd: 0 },
      overdue_31_60: { count: 0, totalUsd: 0 },
      overdue_61_90: { count: 0, totalUsd: 0 },
      overdue_90_plus: { count: 0, totalUsd: 0 },
    };
    const today = new Date();
    let totalOpenUsd = 0;
    let totalOverdueUsd = 0;
    let totalOverdueCount = 0;

    for (const cxp of rows) {
      const balance = Number(cxp.balanceUsd) || 0;
      const bucket = this.classifyAging(cxp.dueDate, cxp.status, today);
      buckets[bucket].count++;
      buckets[bucket].totalUsd += balance;
      totalOpenUsd += balance;
      if (bucket !== 'current') {
        totalOverdueUsd += balance;
        totalOverdueCount++;
      }
    }

    // Redondeo a 2 decimales para consistencia con UI.
    for (const k of Object.keys(buckets) as AgingBucket[]) {
      buckets[k].totalUsd = round2(buckets[k].totalUsd);
    }

    return {
      branchId,
      buckets,
      totalOpenUsd: round2(totalOpenUsd),
      totalOpenCount: rows.length,
      totalOverdueUsd: round2(totalOverdueUsd),
      totalOverdueCount,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────

  private classifyAging(dueDate: Date | string, status: AccountsPayableEntity['status'], today: Date): AgingBucket {
    if (status === 'paid' || status === 'cancelled') return 'current';
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / 86400000);
    if (daysOverdue <= 0) return 'current';
    if (daysOverdue <= 30) return 'overdue_1_30';
    if (daysOverdue <= 60) return 'overdue_31_60';
    if (daysOverdue <= 90) return 'overdue_61_90';
    return 'overdue_90_plus';
  }

  private serialize(cxp: AccountsPayableEntity, includePayments = false) {
    const today = new Date();
    return {
      id: cxp.id,
      supplierId: cxp.supplierId,
      supplier: cxp.supplier
        ? {
            id: cxp.supplier.id,
            name: cxp.supplier.tradeName ?? cxp.supplier.businessName,
          }
        : null,
      branchId: cxp.branchId,
      branch: cxp.branch ? { id: cxp.branch.id, name: cxp.branch.name } : null,
      sourceReceiptId: cxp.sourceReceiptId,
      invoiceNumber: cxp.invoiceNumber,
      invoiceDate: cxp.invoiceDate,
      dueDate: cxp.dueDate,
      currencyNative: cxp.currencyNative,
      originalAmountUsd: Number(cxp.originalAmountUsd),
      originalAmountNative: Number(cxp.originalAmountNative),
      exchangeRateAtCreation: cxp.exchangeRateAtCreation != null ? Number(cxp.exchangeRateAtCreation) : null,
      paidAmountUsd: Number(cxp.paidAmountUsd),
      balanceUsd: Number(cxp.balanceUsd),
      status: cxp.status,
      paymentTermsDays: cxp.paymentTermsDays,
      agingBucket: this.classifyAging(cxp.dueDate, cxp.status, today),
      daysOverdue: this.daysOverdue(cxp.dueDate, cxp.status, today),
      notes: cxp.notes,
      createdAt: cxp.createdAt,
      updatedAt: cxp.updatedAt,
      payments: includePayments && cxp.payments ? cxp.payments : undefined,
    };
  }

  private daysOverdue(dueDate: Date | string, status: AccountsPayableEntity['status'], today: Date): number {
    if (status === 'paid' || status === 'cancelled') return 0;
    const due = dueDate instanceof Date ? dueDate : new Date(dueDate);
    return Math.max(0, Math.floor((today.getTime() - due.getTime()) / 86400000));
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
