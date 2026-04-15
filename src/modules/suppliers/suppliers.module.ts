import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SuppliersService } from './suppliers.service';
import { SuppliersController } from './suppliers.controller';
import { SupplierEntity } from './infrastructure/persistence/relational/entities/supplier.entity';
import { SupplierProductEntity } from './infrastructure/persistence/relational/entities/supplier-product.entity';
import { SupplierContactEntity } from './infrastructure/persistence/relational/entities/supplier-contact.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupplierEntity, SupplierProductEntity, SupplierContactEntity, ProductEntity])],
  controllers: [SuppliersController],
  providers: [SuppliersService],
  exports: [SuppliersService],
})
export class SuppliersModule {}
