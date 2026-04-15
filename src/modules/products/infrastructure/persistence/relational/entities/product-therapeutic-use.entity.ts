import { Entity, ManyToOne, JoinColumn, PrimaryColumn } from 'typeorm';

import { ProductEntity } from './product.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';

@Entity('product_therapeutic_uses')
export class ProductTherapeuticUseEntity extends EntityRelationalHelper {
  @PrimaryColumn('uuid', { name: 'product_id' })
  productId: string;

  @PrimaryColumn('uuid', { name: 'therapeutic_use_id' })
  therapeuticUseId: string;

  @ManyToOne(() => ProductEntity)
  @JoinColumn({ name: 'product_id' })
  product: ProductEntity;

  @ManyToOne(() => TherapeuticUseEntity)
  @JoinColumn({ name: 'therapeutic_use_id' })
  therapeuticUse: TherapeuticUseEntity;
}
