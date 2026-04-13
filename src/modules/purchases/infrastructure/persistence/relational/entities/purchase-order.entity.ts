import { Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { PurchaseOrderItemEntity } from './purchase-order-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('purchase_orders')
export class PurchaseOrderEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'order_number', length: 30, unique: true })
  orderNumber: string;

  @Column('date', { name: 'order_date', default: () => 'CURRENT_DATE' })
  orderDate: Date;

  @Column('date', { name: 'expected_date', nullable: true })
  expectedDate: Date | null;

  @Column('varchar', { name: 'order_type', length: 15, default: 'purchase' })
  orderType: string;

  @Column('varchar', { length: 20, default: 'draft' })
  status: string;

  @Column('decimal', { name: 'subtotal_usd', precision: 18, scale: 4, default: 0 })
  subtotalUsd: number;

  @Column('decimal', { name: 'tax_usd', precision: 18, scale: 4, default: 0 })
  taxUsd: number;

  @Column('decimal', { name: 'total_usd', precision: 18, scale: 4, default: 0 })
  totalUsd: number;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('varchar', { name: 'generated_by', length: 20, default: 'manual' })
  generatedBy: string;

  @Column('uuid', { name: 'created_by' })
  createdBy: string;

  @Column('uuid', { name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PurchaseOrderItemEntity, (item) => item.order, { cascade: true })
  items: PurchaseOrderItemEntity[];
}
