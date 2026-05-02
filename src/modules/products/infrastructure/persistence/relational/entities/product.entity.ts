import {
  Index,
  Column,
  Entity,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ProductBarcodeEntity } from './product-barcode.entity';
import { ProductSubstituteEntity } from './product-substitute.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ProductActiveIngredientEntity } from './product-active-ingredient.entity';
import { BrandEntity } from '@/modules/brands/infrastructure/persistence/relational/entities/brand.entity';
import { CategoryEntity } from '@/modules/categories/infrastructure/persistence/relational/entities/category.entity';

@Index('idx_products_ean', ['ean'], {})
@Index('idx_products_category', ['categoryId'], {})
@Index('idx_products_type', ['productType'], {})
@Index('idx_products_blocked', ['inventoryBlocked'], { where: 'inventory_blocked = TRUE' })
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

  @ManyToOne(() => CategoryEntity, { eager: false })
  @JoinColumn({ name: 'category_id' })
  category: CategoryEntity;

  @Column('uuid', { name: 'brand_id', nullable: true })
  brandId: string | null;

  @ManyToOne(() => BrandEntity, { eager: false })
  @JoinColumn({ name: 'brand_id' })
  brand: BrandEntity;

  @Column('varchar', { name: 'product_type', length: 20, default: 'general' })
  productType: string;

  @Column('varchar', { name: 'sencamer_registration', length: 50, nullable: true })
  sencamerRegistration: string | null;

  @Column('boolean', { name: 'is_controlled', default: false })
  isControlled: boolean;

  @Column('boolean', { name: 'is_antibiotic', default: false })
  isAntibiotic: boolean;

  /**
   * Producto importado (mayoristas extranjeros). Categoría especial que puede
   * requerir aprobador adicional al crear OCs (PDF Política OC §2).
   */
  @Column('boolean', { name: 'is_imported', default: false })
  isImported: boolean;

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

  @Column('boolean', { name: 'inventory_blocked', default: false })
  inventoryBlocked: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => ProductActiveIngredientEntity, (pai) => pai.product, { cascade: true })
  activeIngredients: ProductActiveIngredientEntity[];

  @OneToMany(() => ProductSubstituteEntity, (ps) => ps.product, { cascade: true })
  substitutes: ProductSubstituteEntity[];

  @OneToMany(() => ProductBarcodeEntity, (pb) => pb.product, { cascade: true })
  barcodes: ProductBarcodeEntity[];
}
