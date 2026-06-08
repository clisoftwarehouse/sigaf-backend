import { Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { InventoryTransferItemEntity } from './inventory-transfer-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Traslado de stock. Dos modalidades:
 *
 * - `inter_branch` (default): mueve stock entre dos sucursales distintas.
 *   Flujo: `draft → in_transit → completed`. Cada cambio de estado registra
 *   kardex (`transfer_out`, `transfer_in`, opcional `transfer_cancelled`).
 *
 * - `intra_branch`: mueve stock entre dos almacenes (warehouse_locations)
 *   del mismo branch (Recepción → Sala de ventas, p. ej.). Flujo instantáneo:
 *   al crearse pasa directo a `completed`. No cambia la cantidad del lote —
 *   solo actualiza su `location_id`. Genera kardex `warehouse_transfer`.
 *
 * Trazabilidad: `lot_id` en items siempre referencia el lote afectado.
 */
@Entity('inventory_transfers')
export class InventoryTransferEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'transfer_number', length: 30, unique: true })
  transferNumber: string;

  @Column('varchar', { name: 'transfer_type', length: 20, default: 'inter_branch' })
  transferType: 'inter_branch' | 'intra_branch';

  @Column('uuid', { name: 'from_branch_id' })
  fromBranchId: string;

  @Column('uuid', { name: 'to_branch_id' })
  toBranchId: string;

  @Column('uuid', { name: 'from_location_id', nullable: true })
  fromLocationId: string | null;

  @Column('uuid', { name: 'to_location_id', nullable: true })
  toLocationId: string | null;

  @Column('uuid', { name: 'source_receipt_id', nullable: true })
  sourceReceiptId: string | null;

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

  @OneToMany(() => InventoryTransferItemEntity, (item) => item.transfer)
  items?: InventoryTransferItemEntity[];
}
