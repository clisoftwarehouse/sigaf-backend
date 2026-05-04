import { In, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USER_REF_FIELDS = new Set([
  'userId',
  'createdBy',
  'updatedBy',
  'deletedBy',
  'approvedBy',
  'reapprovedBy',
  'cancelledBy',
  'receivedBy',
  'closedBy',
  'reviewedBy',
]);

function isUserRefField(field: string): boolean {
  return USER_REF_FIELDS.has(field) || field.endsWith('By');
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepo: Repository<AuditLogEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
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
  }): Promise<{
    data: AuditLogEntity[];
    total: number;
    page: number;
    limit: number;
    users: Record<string, string>;
  }> {
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

    const users = await this.resolveUserNames(data);

    return { data, total, page, limit, users };
  }

  private async resolveUserNames(rows: AuditLogEntity[]): Promise<Record<string, string>> {
    const ids = new Set<string>();

    for (const row of rows) {
      if (row.userId) ids.add(row.userId);
      this.collectUserRefIds(row.oldValues, ids);
      this.collectUserRefIds(row.newValues, ids);
    }

    if (ids.size === 0) return {};

    const found = await this.usersRepo.find({
      where: { id: In([...ids]) },
      select: { id: true, fullName: true },
    });

    const map: Record<string, string> = {};
    for (const u of found) {
      map[u.id] = u.fullName;
    }
    return map;
  }

  private collectUserRefIds(values: Record<string, unknown> | null, ids: Set<string>): void {
    if (!values) return;
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === 'string' && UUID_RE.test(val) && isUserRefField(key)) {
        ids.add(val);
      }
    }
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
