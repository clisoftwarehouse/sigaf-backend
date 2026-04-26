import { Column, Entity, UpdateDateColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

export type SupplierClaimType = 'quality' | 'quantity' | 'price_mismatch' | 'other';
export type SupplierClaimStatus = 'open' | 'in_progress' | 'resolved' | 'rejected';

@Entity('supplier_claims')
export class SupplierClaimEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'claim_number', length: 30, unique: true })
  claimNumber: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('uuid', { name: 'receipt_id', nullable: true })
  receiptId: string | null;

  @Column('uuid', { name: 'branch_id', nullable: true })
  branchId: string | null;

  @Column('varchar', { name: 'claim_type', length: 20 })
  claimType: SupplierClaimType;

  @Column('varchar', { length: 15, default: 'open' })
  status: SupplierClaimStatus;

  @Column('varchar', { length: 120 })
  title: string;

  @Column('text')
  description: string;

  @Column('decimal', { name: 'amount_usd', precision: 18, scale: 4, nullable: true })
  amountUsd: number | null;

  @Column('text', { name: 'resolution_notes', nullable: true })
  resolutionNotes: string | null;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @Column('uuid', { name: 'resolved_by', nullable: true })
  resolvedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column('timestamptz', { name: 'resolved_at', nullable: true })
  resolvedAt: Date | null;
}
