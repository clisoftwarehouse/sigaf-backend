import { Index, Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('idx_products_ean', ['ean'], {})
@Index('idx_products_category', ['categoryId'], {})
@Index('idx_products_type', ['productType'], {})
@Entity('products')
export class ProductEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { length: 20, nullable: true, unique: true })
  ean: string | null;

  @Column('varchar', { name: 'internal_code', length: 30, nullable: true, unique: true })
  internalCode: string | null;

  @Column('varchar', { length: 300 })
  description: string;

  @Column('varchar', { name: 'short_name', length: 100, nullable: true })
  shortName: string | null;

  @Column('uuid', { name: 'category_id' })
  categoryId: string;

  @Column('uuid', { name: 'brand_id', nullable: true })
  brandId: string | null;

  @Column('varchar', { name: 'product_type', length: 20, default: 'general' })
  productType: string;

  @Column('boolean', { name: 'is_controlled', default: false })
  isControlled: boolean;

  @Column('boolean', { name: 'is_antibiotic', default: false })
  isAntibiotic: boolean;

  @Column('boolean', { name: 'requires_recipe', default: false })
  requiresRecipe: boolean;

  @Column('boolean', { name: 'is_weighable', default: false })
  isWeighable: boolean;

  @Column('varchar', { name: 'unit_of_measure', length: 10, default: 'UND' })
  unitOfMeasure: string;

  @Column('smallint', { name: 'decimal_places', default: 0 })
  decimalPlaces: number;

  @Column('varchar', { length: 100, nullable: true })
  presentation: string | null;

  @Column('varchar', { name: 'tax_type', length: 15, default: 'exempt' })
  taxType: string;

  @Column('decimal', { precision: 18, scale: 4, nullable: true })
  pmvp: number | null;

  @Column('varchar', { name: 'conservation_type', length: 30, nullable: true, default: 'ambient' })
  conservationType: string | null;

  @Column('decimal', { name: 'min_temperature', precision: 5, scale: 2, nullable: true })
  minTemperature: number | null;

  @Column('decimal', { name: 'max_temperature', precision: 5, scale: 2, nullable: true })
  maxTemperature: number | null;

  @Column('decimal', { name: 'stock_min', precision: 12, scale: 3, default: 0 })
  stockMin: number;

  @Column('decimal', { name: 'stock_max', precision: 12, scale: 3, nullable: true })
  stockMax: number | null;

  @Column('decimal', { name: 'reorder_point', precision: 12, scale: 3, nullable: true })
  reorderPoint: number | null;

  @Column('smallint', { name: 'lead_time_days', nullable: true, default: 0 })
  leadTimeDays: number | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
