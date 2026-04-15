import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

export const BRAND_TYPES = [
  'mass_consumption',
  'pharma',
  'otc',
  'cosmetic',
  'personal_care',
  'supplements',
  'food',
  'medical_device',
  'other',
] as const;
export type BrandType = (typeof BRAND_TYPES)[number];

@Entity('brands')
export class BrandEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 100, unique: true })
  name: string;

  @Column('boolean', { name: 'is_laboratory', default: false })
  isLaboratory: boolean;

  @Column('varchar', { length: 20, nullable: true })
  rif: string | null;

  @Column('varchar', { name: 'business_name', length: 200, nullable: true })
  businessName: string | null;

  @Column('text', { nullable: true })
  address: string | null;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 150, nullable: true })
  email: string | null;

  @Column('varchar', { name: 'country_of_origin', length: 100, nullable: true })
  countryOfOrigin: string | null;

  @Column('varchar', { name: 'brand_type', length: 30, default: 'other' })
  brandType: BrandType;

  @Column('boolean', { name: 'is_importer', default: false })
  isImporter: boolean;

  @Column('boolean', { name: 'is_manufacturer', default: false })
  isManufacturer: boolean;

  @Column('varchar', { name: 'tax_regime', length: 50, nullable: true })
  taxRegime: string | null;

  @Column('uuid', { name: 'supplier_id', nullable: true })
  supplierId: string | null;

  @Column('uuid', { name: 'parent_brand_id', nullable: true })
  parentBrandId: string | null;

  @Column('varchar', { length: 255, nullable: true })
  website: string | null;

  @Column('varchar', { name: 'logo_url', length: 500, nullable: true })
  logoUrl: string | null;

  @Column('varchar', { name: 'regulatory_code', length: 100, nullable: true })
  regulatoryCode: string | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
