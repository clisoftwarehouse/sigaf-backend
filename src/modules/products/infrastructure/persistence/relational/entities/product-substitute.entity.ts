import { Column, Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';

import { ProductEntity } from './product.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('product_substitutes')
export class ProductSubstituteEntity extends EntityRelationalHelper {
  @PrimaryColumn('uuid', { name: 'product_id' })
  productId: string;

  @PrimaryColumn('uuid', { name: 'substitute_id' })
  substituteId: string;

  @Column('smallint', { default: 1 })
  priority: number;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'substitute_id' })
  substitute: ProductEntity;
}
