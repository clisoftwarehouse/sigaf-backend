import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { StandardizationSeedService } from './standardization-seed.service';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ActiveIngredientEntity, TherapeuticUseEntity])],
  providers: [StandardizationSeedService],
  exports: [StandardizationSeedService],
})
export class StandardizationSeedModule {}
