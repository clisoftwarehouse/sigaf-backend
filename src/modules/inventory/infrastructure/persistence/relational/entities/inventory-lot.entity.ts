import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('inventory_lots_product_id_branch_id_lot_number_key', ['branchId', 'lotNumber', 'productId'], { unique: true })
@Index('idx_inventory_lots_expiration', ['expirationDate'], {})
@Index('idx_inventory_lots_status', ['status'], {})
@Entity('inventory_lots')
export class InventoryLotEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { name: 'lot_number', length: 50 })
  lotNumber: string;

  @Column('date', { name: 'expiration_date' })
  expirationDate: Date;

  @Column('date', { name: 'manufacture_date', nullable: true })
  manufactureDate: Date | null;

  @Column('varchar', { name: 'acquisition_type', length: 15, default: 'purchase' })
  acquisitionType: string;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @Column('uuid', { name: 'consignment_entry_id', nullable: true })
  consignmentEntryId: string | null;

  @Column('decimal', { name: 'cost_usd', precision: 18, scale: 4, default: 0 })
  costUsd: number;

  @Column('decimal', { name: 'sale_price', precision: 18, scale: 4 })
  salePrice: number;

  @Column('decimal', { name: 'margin_pct', nullable: true, precision: 5, scale: 2 })
  marginPct: number | null;

  @Column('decimal', { name: 'quantity_received', precision: 12, scale: 3 })
  quantityReceived: number;

  @Column('decimal', { name: 'quantity_available', precision: 12, scale: 3, default: 0 })
  quantityAvailable: number;

  @Column('decimal', { name: 'quantity_reserved', precision: 12, scale: 3, default: 0 })
  quantityReserved: number;

  @Column('decimal', { name: 'quantity_sold', precision: 12, scale: 3, default: 0 })
  quantitySold: number;

  @Column('decimal', { name: 'quantity_damaged', precision: 12, scale: 3, default: 0 })
  quantityDamaged: number;

  @Column('decimal', { name: 'quantity_returned', precision: 12, scale: 3, default: 0 })
  quantityReturned: number;

  @Column('uuid', { name: 'location_id', nullable: true })
  locationId: string | null;

  @Column('varchar', { name: 'status', length: 20, default: 'available' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
