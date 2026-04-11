import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('inventory_transfers')
export class InventoryTransferEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'transfer_number', length: 30, unique: true })
  transferNumber: string;

  @Column('uuid', { name: 'from_branch_id' })
  fromBranchId: string;

  @Column('uuid', { name: 'to_branch_id' })
  toBranchId: string;

  @Column('varchar', { length: 20, default: 'draft' })
  status: string;

  @Column('date', { name: 'transfer_date', default: () => 'CURRENT_DATE' })
  transferDate: Date;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @Column('uuid', { name: 'sent_by', nullable: true })
  sentBy: string | null;

  @Column('timestamptz', { name: 'sent_at', nullable: true })
  sentAt: Date | null;

  @Column('uuid', { name: 'received_by', nullable: true })
  receivedBy: string | null;

  @Column('timestamptz', { name: 'received_at', nullable: true })
  receivedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
