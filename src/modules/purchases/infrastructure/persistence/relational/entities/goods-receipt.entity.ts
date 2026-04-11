import { Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('goods_receipts')
export class GoodsReceiptEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('uuid', { name: 'purchase_order_id', nullable: true })
  purchaseOrderId: string | null;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @Column('varchar', { name: 'receipt_number', length: 30, unique: true })
  receiptNumber: string;

  @Column('date', { name: 'receipt_date', default: () => 'CURRENT_DATE' })
  receiptDate: Date;

  @Column('varchar', { name: 'supplier_invoice_number', length: 50, nullable: true })
  supplierInvoiceNumber: string | null;

  @Column('varchar', { name: 'receipt_type', length: 15, default: 'purchase' })
  receiptType: string;

  @Column('varchar', { name: 'import_source', length: 20, nullable: true })
  importSource: string | null;

  @Column('decimal', { name: 'total_usd', precision: 18, scale: 4, default: 0 })
  totalUsd: number;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'received_by' })
  receivedBy: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
