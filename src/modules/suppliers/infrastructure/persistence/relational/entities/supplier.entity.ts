import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('suppliers_rif_key', ['rif'], { unique: true })
@Entity('suppliers')
export class SupplierEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 20, unique: true })
  rif: string;

  @Column('varchar', { name: 'business_name', length: 200 })
  businessName: string;

  @Column('varchar', { name: 'trade_name', length: 200, nullable: true })
  tradeName: string | null;

  @Column('varchar', { name: 'contact_name', length: 150, nullable: true })
  contactName: string | null;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 150, nullable: true })
  email: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column('boolean', { name: 'is_drugstore', default: false })
  isDrugstore: boolean;

  @Column('varchar', { name: 'api_endpoint', length: 500, nullable: true })
  apiEndpoint: string | null;

  @Column('text', { name: 'api_key_encrypted', nullable: true })
  apiKeyEncrypted: string | null;

  @Column('smallint', { name: 'payment_terms_days', nullable: true, default: 30 })
  paymentTermsDays: number | null;

  @Column('decimal', { name: 'consignment_commission_pct', precision: 5, scale: 2, nullable: true })
  consignmentCommissionPct: number | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Moneda en la que el proveedor emite sus facturas. Solo es una pista para
   * pre-seleccionar la moneda en el formulario de recepción; el operador puede
   * sobreescribirlo caso por caso.
   */
  @Column('varchar', { name: 'invoices_in_currency', length: 3, default: 'USD' })
  invoicesInCurrency: 'USD' | 'VES';

  // ─── Descuentos comerciales (para BI) ──────────────────────────────────
  // Cada tipo tiene un switch (¿lo ofrece?) y un porcentaje típico opcional.
  // BI puede agregar tanto la presencia como la magnitud para ranking de
  // proveedores y simulación de costos.

  @Column('boolean', { name: 'has_header_discount', default: false })
  hasHeaderDiscount: boolean;

  @Column('decimal', { name: 'header_discount_pct', precision: 5, scale: 2, nullable: true })
  headerDiscountPct: number | null;

  @Column('boolean', { name: 'has_linear_discount', default: false })
  hasLinearDiscount: boolean;

  @Column('decimal', { name: 'linear_discount_pct', precision: 5, scale: 2, nullable: true })
  linearDiscountPct: number | null;

  @Column('boolean', { name: 'has_prompt_payment_discount', default: false })
  hasPromptPaymentDiscount: boolean;

  @Column('decimal', { name: 'prompt_payment_discount_pct', precision: 5, scale: 2, nullable: true })
  promptPaymentDiscountPct: number | null;

  @Column('boolean', { name: 'has_volume_discount', default: false })
  hasVolumeDiscount: boolean;

  @Column('decimal', { name: 'volume_discount_pct', precision: 5, scale: 2, nullable: true })
  volumeDiscountPct: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
