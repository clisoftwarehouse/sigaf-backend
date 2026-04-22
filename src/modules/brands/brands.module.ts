import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { BrandsService } from './brands.service';
import { BrandsController } from './brands.controller';
import { BrandEntity } from './infrastructure/persistence/relational/entities/brand.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([BrandEntity, ProductEntity])],
  controllers: [BrandsController],
  providers: [BrandsService],
  exports: [BrandsService],
})
export class BrandsModule {}
