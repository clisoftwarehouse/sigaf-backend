import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('idx_kardex_product', ['branchId', 'createdAt', 'productId'], {})
@Entity('kardex')
export class KardexEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'lot_id', nullable: true })
  lotId: string | null;

  @Column('varchar', { name: 'movement_type', length: 30 })
  movementType: string;

  @Column('decimal', { name: 'quantity', precision: 12, scale: 3 })
  quantity: number;

  @Column('decimal', { name: 'unit_cost_usd', nullable: true, precision: 18, scale: 4 })
  unitCostUsd: number | null;

  @Column('decimal', { name: 'balance_after', precision: 12, scale: 3 })
  balanceAfter: number;

  @Column('varchar', { name: 'reference_type', nullable: true, length: 50 })
  referenceType: string | null;

  @Column('uuid', { name: 'reference_id', nullable: true })
  referenceId: string | null;

  @Column('text', { name: 'notes', nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('uuid', { name: 'terminal_id', nullable: true })
  terminalId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
