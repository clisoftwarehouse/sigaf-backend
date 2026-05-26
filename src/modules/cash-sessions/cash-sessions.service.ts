import { InjectRepository } from '@nestjs/typeorm';
import { Between, Repository, DataSource } from 'typeorm';
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

import { CashSessionEntity } from './infrastructure/persistence/relational/entities/cash-session.entity';
import { CashMovementEntity } from './infrastructure/persistence/relational/entities/cash-movement.entity';
import { OpenCashSessionDto, CloseCashSessionDto, QueryCashSessionDto, CreateManualMovementDto } from './dto';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';

export interface XReportTotals {
  byMethod: Record<string, { count: number; totalUsd: number; totalBs: number }>;
  totals: {
    openingUsd: number;
    openingBs: number;
    salesUsd: number;
    returnsUsd: number;
    payoutsUsd: number;
    depositsUsd: number;
    adjustmentsUsd: number;
    expectedUsd: number;
    expectedBs: number;
    movementCount: number;
  };
  generatedAt: Date;
}

@Injectable()
export class CashSessionsService {
  constructor(
    @InjectRepository(CashSessionEntity)
    private readonly sessionRepo: Repository<CashSessionEntity>,
    @InjectRepository(CashMovementEntity)
    private readonly movementRepo: Repository<CashMovementEntity>,
    @InjectRepository(TerminalEntity)
    private readonly terminalRepo: Repository<TerminalEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async open(dto: OpenCashSessionDto, userId: string | null): Promise<CashSessionEntity> {
    // El controller pasa dto.cashierUserId; si el payload era antiguo (sin
    // este campo), `userId` viene null. Fallamos claro porque la apertura
    // necesita identificar al operador para el audit del turno.
    if (!userId) {
      throw new BadRequestException(
        'Falta cashierUserId en el payload de apertura. Si esta operación quedó en cola desde una versión vieja del POS, descártala y reabre caja.',
      );
    }
    const terminal = await this.terminalRepo.findOne({
      where: { id: dto.terminalId, isActive: true },
    });
    if (!terminal) throw new BadRequestException('Terminal no existe o está inactivo');

    const existingOpen = await this.sessionRepo.findOne({
      where: { terminalId: dto.terminalId, status: 'open' },
    });
    if (existingOpen) {
      throw new ConflictException(`Ya existe una sesión abierta para este terminal (id ${existingOpen.id})`);
    }

    // Si el POS mandó `clientOpenedAt` (apertura offline que sube luego), lo
    // usamos como timestamp real del turno. Sin esto el reporte mostraría el
    // turno empezando cuando se sincronizó (hora del backend), no cuando el
    // cajero efectivamente abrió la caja.
    const openedAt = dto.clientOpenedAt ? new Date(dto.clientOpenedAt) : new Date();

    return this.dataSource.transaction(async (manager) => {
      const session = manager.create(CashSessionEntity, {
        terminalId: dto.terminalId,
        branchId: terminal.branchId,
        openedByUserId: userId,
        openedAt,
        openingAmountUsd: dto.openingAmountUsd,
        openingAmountBs: dto.openingAmountBs ?? 0,
        status: 'open',
        notes: dto.notes ?? null,
      });
      const saved = await manager.save(session);

      // Asentamos el opening como movement para auditar.
      if (dto.openingAmountUsd > 0) {
        await manager.save(
          manager.create(CashMovementEntity, {
            cashSessionId: saved.id,
            type: 'opening',
            paymentMethod: 'EFECTIVO_USD',
            amountUsd: dto.openingAmountUsd,
            amountBs: 0,
            createdByUserId: userId,
            notes: 'Apertura de caja (USD)',
          }),
        );
      }
      if (dto.openingAmountBs && dto.openingAmountBs > 0) {
        await manager.save(
          manager.create(CashMovementEntity, {
            cashSessionId: saved.id,
            type: 'opening',
            paymentMethod: 'EFECTIVO_BS',
            amountUsd: 0,
            amountBs: dto.openingAmountBs,
            createdByUserId: userId,
            notes: 'Apertura de caja (Bs)',
          }),
        );
      }

      return manager.findOneOrFail(CashSessionEntity, {
        where: { id: saved.id },
        relations: ['terminal', 'branch', 'openedBy'],
      });
    });
  }

  async close(id: string, dto: CloseCashSessionDto, userId: string | null): Promise<CashSessionEntity> {
    const session = await this.findOne(id);
    if (session.status !== 'open') {
      throw new BadRequestException('La sesión no está abierta');
    }

    // Fallback retro-compat: si el payload es viejo (sin cashierUserId),
    // atribuimos el cierre al mismo operador que abrió. En la práctica suele
    // ser la misma persona; el comentario en la sesión queda con esta nota.
    const closerId = userId ?? session.openedByUserId;

    const totals = await this.computeXReport(id);
    const calcUsd = totals.totals.expectedUsd;
    const calcBs = totals.totals.expectedBs;
    const declaredUsd = dto.closingDeclaredUsd;
    const declaredBs = dto.closingDeclaredBs ?? 0;

    // Igual que en open: si el POS mandó `clientClosedAt` (cierre offline que
    // subió después), usamos esa hora como real. Sin esto el reporte mostraría
    // que el cajero cerró cuando se sincronizó la operación.
    const closedAt = dto.clientClosedAt ? new Date(dto.clientClosedAt) : new Date();

    return this.dataSource.transaction(async (manager) => {
      const closed = await manager.findOneOrFail(CashSessionEntity, { where: { id } });
      closed.status = 'closed';
      closed.closedAt = closedAt;
      closed.closedByUserId = closerId;
      closed.closingDeclaredUsd = declaredUsd;
      closed.closingDeclaredBs = declaredBs;
      closed.closingCalculatedUsd = calcUsd;
      closed.closingCalculatedBs = calcBs;
      closed.differenceUsd = +(declaredUsd - calcUsd).toFixed(4);
      closed.differenceBs = +(declaredBs - calcBs).toFixed(2);
      if (dto.notes) closed.notes = dto.notes;
      await manager.save(closed);

      return manager.findOneOrFail(CashSessionEntity, {
        where: { id },
        relations: ['terminal', 'branch', 'openedBy', 'closedBy'],
      });
    });
  }

  async findCurrentByTerminal(terminalId: string): Promise<CashSessionEntity | null> {
    return this.sessionRepo.findOne({
      where: { terminalId, status: 'open' },
      relations: ['terminal', 'branch', 'openedBy'],
    });
  }

  async findOne(id: string): Promise<CashSessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['terminal', 'branch', 'openedBy', 'closedBy', 'movements'],
    });
    if (!session) throw new NotFoundException('Sesión de caja no encontrada');
    return session;
  }

  async findAll(query: QueryCashSessionDto): Promise<{
    data: CashSessionEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const where: Record<string, unknown> = {};
    if (query.terminalId) where.terminalId = query.terminalId;
    if (query.branchId) where.branchId = query.branchId;
    if (query.status) where.status = query.status;
    if (query.from && query.to) {
      where.openedAt = Between(new Date(query.from), new Date(query.to));
    }

    const [data, total] = await this.sessionRepo.findAndCount({
      where,
      relations: ['terminal', 'branch', 'openedBy', 'closedBy'],
      order: { openedAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async addManualMovement(
    sessionId: string,
    dto: CreateManualMovementDto,
    userId: string | null,
  ): Promise<CashMovementEntity> {
    const session = await this.findOne(sessionId);
    if (session.status !== 'open') {
      throw new BadRequestException('No se puede agregar movimientos a una sesión cerrada');
    }

    // Fallback retro-compat: si cashierUserId no viene en el payload, lo
    // atribuimos al operador que abrió la sesión.
    const moverId = userId ?? session.openedByUserId;

    const movement = this.movementRepo.create({
      cashSessionId: sessionId,
      type: dto.type,
      paymentMethod: dto.paymentMethod,
      amountUsd: dto.amountUsd,
      amountBs: dto.amountBs ?? 0,
      exchangeRateUsed: dto.exchangeRateUsed ?? null,
      notes: dto.notes,
      createdByUserId: moverId,
    });
    return this.movementRepo.save(movement);
  }

  /**
   * X-Report: corte parcial de la sesión sin cerrarla. Suma todos los
   * movements y produce los totales esperados por método y consolidado.
   */
  async computeXReport(sessionId: string): Promise<XReportTotals> {
    const session = await this.findOne(sessionId);

    const byMethod: Record<string, { count: number; totalUsd: number; totalBs: number }> = {};
    let salesUsd = 0;
    let returnsUsd = 0;
    let payoutsUsd = 0;
    let depositsUsd = 0;
    let adjustmentsUsd = 0;
    let openingUsd = 0;
    let openingBs = 0;

    for (const m of session.movements ?? []) {
      const method = m.paymentMethod;
      const usd = Number(m.amountUsd);
      const bs = Number(m.amountBs);
      if (!byMethod[method]) byMethod[method] = { count: 0, totalUsd: 0, totalBs: 0 };
      byMethod[method].count += 1;
      byMethod[method].totalUsd += usd;
      byMethod[method].totalBs += bs;

      switch (m.type) {
        case 'opening':
          if (method === 'EFECTIVO_USD') openingUsd += usd;
          else if (method === 'EFECTIVO_BS') openingBs += bs;
          break;
        case 'sale':
          salesUsd += usd;
          break;
        case 'return':
          returnsUsd += usd;
          break;
        case 'payout':
          payoutsUsd += usd;
          break;
        case 'deposit':
          depositsUsd += usd;
          break;
        case 'adjustment':
          adjustmentsUsd += usd;
          break;
      }
    }

    // Esperado en gaveta = apertura + ventas EFECTIVO - devoluciones EFECTIVO
    //                      - payouts + deposits + adjustments.
    // Para USD/Bs separados, sólo cuentan EFECTIVO_USD / EFECTIVO_BS.
    const expectedUsd =
      Number(session.openingAmountUsd) + (byMethod['EFECTIVO_USD']?.totalUsd ?? 0) - (openingUsd > 0 ? openingUsd : 0); // no contar el opening dos veces
    const expectedBs =
      Number(session.openingAmountBs) + (byMethod['EFECTIVO_BS']?.totalBs ?? 0) - (openingBs > 0 ? openingBs : 0);

    return {
      byMethod,
      totals: {
        openingUsd: Number(session.openingAmountUsd),
        openingBs: Number(session.openingAmountBs),
        salesUsd: +salesUsd.toFixed(4),
        returnsUsd: +returnsUsd.toFixed(4),
        payoutsUsd: +payoutsUsd.toFixed(4),
        depositsUsd: +depositsUsd.toFixed(4),
        adjustmentsUsd: +adjustmentsUsd.toFixed(4),
        expectedUsd: +expectedUsd.toFixed(4),
        expectedBs: +expectedBs.toFixed(2),
        movementCount: session.movements?.length ?? 0,
      },
      generatedAt: new Date(),
    };
  }

  async getXReport(sessionId: string): Promise<XReportTotals> {
    return this.computeXReport(sessionId);
  }

  /**
   * Z-Report: equivalente al X pero requiere que la sesión esté cerrada,
   * y agrega los datos de cierre (declared/calculated/difference).
   */
  async getZReport(sessionId: string): Promise<{
    session: CashSessionEntity;
    totals: XReportTotals;
  }> {
    const session = await this.findOne(sessionId);
    if (session.status === 'open') {
      throw new BadRequestException('Z-Report sólo disponible después de cerrar la sesión');
    }
    const totals = await this.computeXReport(sessionId);
    return { session, totals };
  }
}
