import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { SaleDocumentEntity } from './infrastructure/persistence/relational/entities/sale-document.entity';
import { DocumentEmissionMethodEntity } from './infrastructure/persistence/relational/entities/document-emission-method.entity';

@Injectable()
export class DocumentEmissionService {
  constructor(
    @InjectRepository(DocumentEmissionMethodEntity)
    private readonly methodRepo: Repository<DocumentEmissionMethodEntity>,
    @InjectRepository(SaleDocumentEntity)
    private readonly docRepo: Repository<SaleDocumentEntity>,
  ) {}

  /** Métodos activos del terminal (para el endpoint del POS y los handlers). */
  findAllActive(terminalId: string): Promise<DocumentEmissionMethodEntity[]> {
    return this.methodRepo.find({
      where: { terminalId, isActive: true },
      order: { priority: 'ASC' },
    });
  }

  /** Config activa de un método puntual en un terminal, o null si no aplica. */
  findActive(terminalId: string, methodKey: string): Promise<DocumentEmissionMethodEntity | null> {
    return this.methodRepo.findOne({ where: { terminalId, methodKey, isActive: true } });
  }

  /** Todos los métodos configurados del terminal (admin: activos e inactivos). */
  findAllForTerminal(terminalId: string): Promise<DocumentEmissionMethodEntity[]> {
    return this.methodRepo.find({ where: { terminalId }, order: { priority: 'ASC' } });
  }

  async upsertMethod(args: {
    terminalId: string;
    methodKey: string;
    configJson?: Record<string, unknown>;
    priority?: number;
    isActive?: boolean;
  }): Promise<DocumentEmissionMethodEntity> {
    const existing = await this.methodRepo.findOne({
      where: { terminalId: args.terminalId, methodKey: args.methodKey },
    });
    if (existing) {
      if (args.configJson !== undefined) existing.configJson = args.configJson;
      if (args.priority !== undefined) existing.priority = args.priority;
      if (args.isActive !== undefined) existing.isActive = args.isActive;
      return this.methodRepo.save(existing);
    }
    return this.methodRepo.save(
      this.methodRepo.create({
        terminalId: args.terminalId,
        methodKey: args.methodKey,
        configJson: args.configJson ?? {},
        priority: args.priority ?? 100,
        isActive: args.isActive ?? true,
      }),
    );
  }

  /**
   * Registra un documento emitido. Idempotente por (ticket, tipo, número):
   * si ya existe (reintento de sync), no duplica.
   */
  async recordDocument(args: {
    saleTicketId: string;
    documentType: string;
    documentNumber?: string | null;
    controlNumber?: string | null;
    emissionMethodId?: string | null;
    rawResponse?: Record<string, unknown> | null;
    status?: string;
    failureReason?: string | null;
  }): Promise<SaleDocumentEntity> {
    if (args.documentNumber) {
      const dup = await this.docRepo.findOne({
        where: {
          saleTicketId: args.saleTicketId,
          documentType: args.documentType,
          documentNumber: args.documentNumber,
        },
      });
      if (dup) return dup;
    }
    return this.docRepo.save(
      this.docRepo.create({
        saleTicketId: args.saleTicketId,
        documentType: args.documentType,
        documentNumber: args.documentNumber ?? null,
        controlNumber: args.controlNumber ?? null,
        emissionMethodId: args.emissionMethodId ?? null,
        rawResponseJson: args.rawResponse ?? null,
        status: args.status ?? 'emitted',
        failureReason: args.failureReason ?? null,
      }),
    );
  }

  findDocumentsByTicket(saleTicketId: string): Promise<SaleDocumentEntity[]> {
    return this.docRepo.find({ where: { saleTicketId }, order: { createdAt: 'ASC' } });
  }
}
