import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { AuditLogEntity } from './infrastructure/persistence/relational/entities/audit-log.entity';

export interface AuditEntry {
  tableName: string;
  recordId: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE';
  oldValues?: unknown;
  newValues?: unknown;
  changedFields?: string[];
  justification?: string;
  userId: string;
  terminalId?: string;
  ipAddress?: string;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
  ) {}

  async log(entry: AuditEntry): Promise<AuditLogEntity> {
    const changedFields =
      entry.changedFields ||
      (entry.oldValues && entry.newValues
        ? this.getChangedFields(entry.oldValues as Record<string, unknown>, entry.newValues as Record<string, unknown>)
        : null);

    const auditLog = this.auditRepo.create({
      tableName: entry.tableName,
      recordId: entry.recordId,
      action: entry.action,
      oldValues: entry.oldValues || null,
      newValues: entry.newValues || null,
      changedFields,
      justification: entry.justification || null,
      userId: entry.userId,
      terminalId: entry.terminalId || null,
      ipAddress: entry.ipAddress || null,
    });

    return this.auditRepo.save(auditLog);
  }

  async findAll(query: {
    tableName?: string;
    recordId?: string;
    action?: string;
    userId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: AuditLogEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.auditRepo.createQueryBuilder('a');

    if (query.tableName) {
      qb.andWhere('a.tableName = :tableName', { tableName: query.tableName });
    }
    if (query.recordId) {
      qb.andWhere('a.recordId = :recordId', { recordId: query.recordId });
    }
    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action });
    }
    if (query.userId) {
      qb.andWhere('a.userId = :userId', { userId: query.userId });
    }
    if (query.from) {
      qb.andWhere('a.createdAt >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('a.createdAt <= :to', { to: new Date(query.to) });
    }

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('a.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  private getChangedFields(oldValues: Record<string, unknown>, newValues: Record<string, unknown>): string[] {
    const changedFields: string[] = [];
    const allKeys = new Set([...Object.keys(oldValues), ...Object.keys(newValues)]);

    for (const key of allKeys) {
      if (JSON.stringify(oldValues[key]) !== JSON.stringify(newValues[key])) {
        changedFields.push(key);
      }
    }

    return changedFields;
  }
}
