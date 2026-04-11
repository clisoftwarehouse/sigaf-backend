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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
