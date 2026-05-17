import {
  Index,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PrescriptionItemEntity } from './prescription-item.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { CustomerEntity } from '@/modules/customers/infrastructure/persistence/relational/entities/customer.entity';

/**
 * Récipe médico asociado a un cliente. Necesario antes de dispensar
 * productos con `requiresRecipe = true` (controlados, antibióticos, etc.).
 *
 * Estados:
 *  - `active`: vigente, se le pueden dispensar items.
 *  - `partially_dispensed`: tiene al menos un item con cantidad parcial.
 *  - `fully_dispensed`: todos los items dispensados a tope.
 *  - `expired`: pasó `expiresAt`.
 *  - `cancelled`: anulado por médico/admin.
 *
 * Vigencia típica: 30-90 días dependiendo de regulación.
 */
export type PrescriptionStatus = 'active' | 'partially_dispensed' | 'fully_dispensed' | 'expired' | 'cancelled';

@Entity('prescriptions')
@Index('idx_prescriptions_customer', ['customerId'])
@Index('idx_prescriptions_status', ['status'])
export class PrescriptionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'customer_id' })
  customerId: string;

  @ManyToOne(() => CustomerEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'customer_id' })
  customer: CustomerEntity;

  @Column('varchar', { name: 'doctor_name', length: 150 })
  doctorName: string;

  @Column('varchar', { name: 'doctor_id_number', length: 30, nullable: true })
  doctorIdNumber: string | null;

  @Column('varchar', { name: 'prescription_number', length: 50, nullable: true })
  prescriptionNumber: string | null;

  @Column('timestamptz', { name: 'issued_at' })
  issuedAt: Date;

  @Column('timestamptz', { name: 'expires_at', nullable: true })
  expiresAt: Date | null;

  @Column('varchar', { length: 30, default: 'active' })
  status: PrescriptionStatus;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('varchar', { name: 'image_url', length: 500, nullable: true })
  imageUrl: string | null;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => PrescriptionItemEntity, (item) => item.prescription, {
    cascade: ['insert', 'update'],
  })
  items: PrescriptionItemEntity[];
}
