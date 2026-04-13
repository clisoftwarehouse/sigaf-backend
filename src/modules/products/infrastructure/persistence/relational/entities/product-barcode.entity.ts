import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ProductEntity } from './product.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('idx_product_barcodes_barcode', ['barcode'], { unique: true })
@Index('idx_product_barcodes_product', ['productId'], {})
@Entity('product_barcodes')
export class ProductBarcodeEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'product_id' })
  productId: string;

  @Column('varchar', { length: 50 })
  barcode: string;

  @Column('varchar', { name: 'barcode_type', length: 30, default: 'ean13' })
  barcodeType: string;

  @Column('boolean', { name: 'is_primary', default: false })
  isPrimary: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ProductEntity, (product) => product.barcodes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;
}
