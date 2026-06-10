import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Médico (prescriptor) registrado en el sistema. Sirve como catálogo
 * normalizado para los récipes y como base de los reportes legales
 * (SACS, dispensación de controlados, etc.).
 *
 * El récipe actual sigue usando los campos sueltos `doctor_name` y
 * `doctor_id_number` — esta tabla no rompe ese flujo. La FK opcional
 * `prescriber_id` se agregará en una migración posterior cuando el
 * frontend esté listo para usarla.
 */
@Index('idx_prescribers_active', ['isActive'], { where: '"is_active" = true' })
@Index('idx_prescribers_name', ['fullName'])
@Entity('prescribers')
export class PrescriberEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'full_name', length: 150 })
  fullName: string;

  @Column('varchar', { length: 100, nullable: true })
  specialty: string | null;

  /**
   * Número MPPS (Ministerio del Poder Popular para la Salud). Es el
   * registro nacional de médicos en Venezuela. Identificador único en la
   * práctica aunque acá no lo marcamos UNIQUE para tolerar errores de
   * carga inicial.
   */
  @Column('varchar', { name: 'mpps_number', length: 30, nullable: true })
  mppsNumber: string | null;

  /** Cédula de identidad (V-12345678 o E-12345678). */
  @Column('varchar', { name: 'national_id', length: 20, nullable: true })
  nationalId: string | null;

  /** RIF si el médico factura honorarios al cliente. */
  @Column('varchar', { length: 20, nullable: true })
  rif: string | null;

  @Column('varchar', { length: 30, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 150, nullable: true })
  email: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
