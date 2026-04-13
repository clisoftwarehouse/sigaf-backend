import { Column, Entity, OneToMany, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ConsignmentReturnItemEntity } from './consignment-return-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_returns')
export class ConsignmentReturnEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'consignment_entry_id' })
  consignmentEntryId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'return_number', length: 30, unique: true })
  returnNumber: string;

  @Column('date', { name: 'return_date', default: () => 'CURRENT_DATE' })
  returnDate: Date;

  @Column('varchar', { length: 50 })
  reason: string;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'processed_by' })
  processedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @OneToMany(() => ConsignmentReturnItemEntity, (item) => item.consignmentReturn, { cascade: true })
  items: ConsignmentReturnItemEntity[];
}
