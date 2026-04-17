import { Column, Entity, OneToMany, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { InventoryTransferItemEntity } from './inventory-transfer-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Traslado de stock entre sucursales.
 *
 * Estados del flujo:
 *   - `draft`       → Se agregan items. Nada de stock se mueve aún.
 *   - `in_transit`  → Tras dispatch: el stock sale de la sucursal origen
 *                     (se registra kardex `transfer_out`).
 *   - `completed`   → Tras receive: el stock entra a la sucursal destino
 *                     (se registra kardex `transfer_in`). Puede recibirse
 *                     menos de lo enviado (mermas) — la diferencia se
 *                     asienta como ajuste automático.
 *   - `cancelled`   → Cancelado. Si estaba in_transit, se revierte el stock
 *                     al lote origen.
 *
 * Trazabilidad: `lot_id` en items siempre referencia el lote de ORIGEN.
 * En destino se crea o reutiliza un lote con el mismo `lot_number` para
 * preservar FEFO.
 */
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

  @OneToMany(() => InventoryTransferItemEntity, (item) => item.transfer)
  items?: InventoryTransferItemEntity[];
}
