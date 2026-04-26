import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { AuditService } from '../audit/audit.service';
import { CreateClaimDto, UpdateClaimDto, QueryClaimsDto } from './dto';
import { SupplierClaimEntity } from './infrastructure/persistence/relational/entities/supplier-claim.entity';

@Injectable()
export class ClaimsService {
  constructor(
    @InjectRepository(SupplierClaimEntity)
    private readonly repo: Repository<SupplierClaimEntity>,
    private readonly auditService: AuditService,
  ) {}

  async findAll(
    query: QueryClaimsDto,
  ): Promise<{ data: SupplierClaimEntity[]; total: number; page: number; limit: number }> {
    const page = query.page || 1;
    const limit = query.limit || 20;

    const qb = this.repo.createQueryBuilder('c');

    if (query.supplierId) qb.andWhere('c.supplierId = :supplierId', { supplierId: query.supplierId });
    if (query.receiptId) qb.andWhere('c.receiptId = :receiptId', { receiptId: query.receiptId });
    if (query.branchId) qb.andWhere('c.branchId = :branchId', { branchId: query.branchId });
    if (query.claimType) qb.andWhere('c.claimType = :claimType', { claimType: query.claimType });
    if (query.status) qb.andWhere('c.status = :status', { status: query.status });
    if (query.from) qb.andWhere('c.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('c.createdAt <= :to', { to: query.to });

    const [data, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .orderBy('c.createdAt', 'DESC')
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async findOne(id: string): Promise<SupplierClaimEntity> {
    const claim = await this.repo.findOne({ where: { id } });
    if (!claim) throw new NotFoundException('Reclamo no encontrado');
    return claim;
  }

  async create(dto: CreateClaimDto, userId: string): Promise<SupplierClaimEntity> {
    const claimNumber = await this.generateClaimNumber();

    const claim = this.repo.create({
      claimNumber,
      supplierId: dto.supplierId,
      receiptId: dto.receiptId ?? null,
      branchId: dto.branchId ?? null,
      claimType: dto.claimType,
      status: 'open',
      title: dto.title,
      description: dto.description,
      amountUsd: dto.amountUsd ?? null,
      createdBy: userId,
    });

    return this.repo.save(claim);
  }

  async update(id: string, dto: UpdateClaimDto, userId: string): Promise<SupplierClaimEntity> {
    const claim = await this.findOne(id);
    const oldValues = { ...claim };

    const wasUnresolved = claim.status === 'open' || claim.status === 'in_progress';
    const willBeResolved = dto.status === 'resolved' || dto.status === 'rejected';

    if (dto.status && claim.status === 'resolved' && dto.status !== 'resolved') {
      throw new BadRequestException('Un reclamo resuelto no puede reabrirse; crea uno nuevo.');
    }

    if (dto.title !== undefined) claim.title = dto.title;
    if (dto.description !== undefined) claim.description = dto.description;
    if (dto.resolutionNotes !== undefined) claim.resolutionNotes = dto.resolutionNotes;
    if (dto.amountUsd !== undefined) claim.amountUsd = dto.amountUsd;
    if (dto.status !== undefined) claim.status = dto.status;

    if (wasUnresolved && willBeResolved) {
      claim.resolvedAt = new Date();
      claim.resolvedBy = userId;
    }

    const updated = await this.repo.save(claim);

    await this.auditService.log({
      tableName: 'supplier_claims',
      recordId: id,
      action: 'UPDATE',
      oldValues,
      newValues: updated,
      userId,
    });

    return updated;
  }

  private async generateClaimNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.repo
      .createQueryBuilder('c')
      .where('c.claimNumber LIKE :pattern', { pattern: `RC-${year}-%` })
      .getCount();
    return `RC-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}
