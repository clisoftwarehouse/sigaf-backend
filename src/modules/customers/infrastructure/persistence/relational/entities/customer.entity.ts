import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Cliente B2C/B2B de la farmacia. Independiente de `users` (que son empleados).
 *
 * Documento venezolano:
 *   - V: Venezolano (7-8 dígitos)
 *   - E: Extranjero residente (7-8 dígitos)
 *   - J: RIF jurídico (9 dígitos)
 *   - G: Gobierno (9 dígitos)
 *   - P: Pasaporte (alfanumérico, hasta 15)
 *
 * El `documentNumber` se guarda SIN el prefijo del tipo. Único por
 * (documentType, documentNumber) entre clientes activos.
 */
export type CustomerDocumentType = 'V' | 'E' | 'J' | 'G' | 'P';
export type CustomerType = 'retail' | 'frecuente' | 'corporativo';

@Entity('customers')
@Index('ux_customers_document', ['documentType', 'documentNumber'], {
  unique: true,
  where: '"is_active" = true',
})
export class CustomerEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'document_type', length: 1 })
  documentType: CustomerDocumentType;

  @Column('varchar', { name: 'document_number', length: 15 })
  documentNumber: string;

  @Column('varchar', { name: 'full_name', length: 150 })
  fullName: string;

  @Column('varchar', { length: 30, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 255, nullable: true })
  email: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column('varchar', { name: 'customer_type', length: 20, default: 'retail' })
  customerType: CustomerType;

  @Column('numeric', {
    name: 'default_discount_percent',
    precision: 5,
    scale: 2,
    default: 0,
  })
  defaultDiscountPercent: number;

  @Column('numeric', {
    name: 'credit_limit_usd',
    precision: 18,
    scale: 4,
    default: 0,
  })
  creditLimitUsd: number;

  @Column('text', { nullable: true })
  notes: string | null;

  // ─── Perfil clínico / CRM (atención al cliente) ───────────────────────
  /** Alergias del paciente. Se muestra como alerta al cajero en el POS. */
  @Column('text', { nullable: true })
  allergies: string | null;

  /** Condiciones crónicas (diabetes, HTA, etc.). */
  @Column('text', { name: 'chronic_conditions', nullable: true })
  chronicConditions: string | null;

  /** Fecha de nacimiento para saludo de cumpleaños / edad. */
  @Column('date', { name: 'birth_date', nullable: true })
  birthDate: Date | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('uuid', { name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
