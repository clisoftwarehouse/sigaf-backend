import { Column, Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';

import { ProductEntity } from './product.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';

@Entity('product_active_ingredients')
export class ProductActiveIngredientEntity extends EntityRelationalHelper {
  @PrimaryColumn('uuid', { name: 'product_id' })
  productId: string;

  @PrimaryColumn('uuid', { name: 'active_ingredient_id' })
  activeIngredientId: string;

  @Column('varchar', { length: 50, nullable: true })
  concentration: string | null;

  @Column('boolean', { name: 'is_primary', default: true })
  isPrimary: boolean;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(() => ActiveIngredientEntity)
  @JoinColumn({ name: 'active_ingredient_id' })
  activeIngredient: ActiveIngredientEntity;
}
