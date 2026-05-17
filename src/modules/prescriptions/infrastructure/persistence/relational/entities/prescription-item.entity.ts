import {
  Index,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PrescriptionEntity } from './prescription.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

/**
 * Línea de récipe: producto + dosis prescrita + cantidad ya dispensada.
 *
 * `quantityPrescribed`: lo que indica el médico (ej. 30 unidades).
 * `quantityDispensed`: lo que se ha entregado en ventas (puede ser parcial,
 *   cliente pasa varias veces a comprar). Sumado por `sales` cuando se
 *   factura un line item con `prescription_id` apuntando a este record.
 */
@Entity('prescription_items')
@Index('idx_prescription_items_prescription', ['prescriptionId'])
@Index('idx_prescription_items_product', ['productId'])
export class PrescriptionItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'prescription_id' })
  prescriptionId: string;

  @ManyToOne(() => PrescriptionEntity, (p) => p.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'prescription_id' })
  prescription: PrescriptionEntity;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @ManyToOne(() => ProductEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @Column('numeric', {
    name: 'quantity_prescribed',
    precision: 12,
    scale: 3,
  })
  quantityPrescribed: number;

  @Column('numeric', {
    name: 'quantity_dispensed',
    precision: 12,
    scale: 3,
    default: 0,
  })
  quantityDispensed: number;

  @Column('varchar', { length: 200, nullable: true })
  posology: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
