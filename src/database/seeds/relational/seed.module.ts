import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';

import appConfig from '@/config/app.config';
import { AllConfigType } from '@/config/config.type';
import { RoleSeedModule } from './role/role-seed.module';
import { UserSeedModule } from './user/user-seed.module';
import { DemoSeedModule } from './demo/demo-seed.module';
import databaseConfig from '../../config/database.config';
import { ConfigSeedModule } from './config/config-seed.module';
import { PermissionSeedModule } from './permission/permission-seed.module';
import { RoleEntity } from '@/modules/roles/infrastructure/persistence/relational/entities/role.entity';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
import { PermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/permission.entity';
import { RolePermissionEntity } from '@/modules/permissions/infrastructure/persistence/relational/entities/role-permission.entity';
import { GlobalConfigEntity } from '@/modules/config-global/infrastructure/persistence/relational/entities/global-config.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { BrandEntity } from '@/modules/brands/infrastructure/persistence/relational/entities/brand.entity';
import { CategoryEntity } from '@/modules/categories/infrastructure/persistence/relational/entities/category.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';
import { ProductEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product.entity';
import { ProductBarcodeEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-barcode.entity';
import { ProductSubstituteEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-substitute.entity';
import { ProductTherapeuticUseEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-therapeutic-use.entity';
import { ProductActiveIngredientEntity } from '@/modules/products/infrastructure/persistence/relational/entities/product-active-ingredient.entity';
import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';
import { WarehouseLocationEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/warehouse-location.entity';
import { ExchangeRateEntity } from '@/modules/exchange-rates/infrastructure/persistence/relational/entities/exchange-rate.entity';
import { InventoryLotEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/inventory-lot.entity';
import { KardexEntity } from '@/modules/inventory/infrastructure/persistence/relational/entities/kardex.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, appConfig],
      envFilePath: ['.env'],
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService<AllConfigType>): DataSourceOptions =>
        ({
          type: configService.get('database.type', { infer: true }),
          url: configService.get('database.url', { infer: true }),
          host: configService.get('database.host', { infer: true }),
          port: configService.get('database.port', { infer: true }),
          username: configService.get('database.username', { infer: true }),
          password: configService.get('database.password', { infer: true }),
          database: configService.get('database.name', { infer: true }),
          synchronize: false,
          dropSchema: false,
          keepConnectionAlive: true,
          logging: configService.get('app.nodeEnv', { infer: true }) !== 'production',
          entities: [
            RoleEntity,
            UserEntity,
            PermissionEntity,
            RolePermissionEntity,
            GlobalConfigEntity,
            BranchEntity,
            SupplierEntity,
            BrandEntity,
            CategoryEntity,
            ActiveIngredientEntity,
            ProductEntity,
            ProductBarcodeEntity,
            ProductActiveIngredientEntity,
            ProductSubstituteEntity,
            ProductTherapeuticUseEntity,
            TherapeuticUseEntity,
            TerminalEntity,
            WarehouseLocationEntity,
            ExchangeRateEntity,
            InventoryLotEntity,
            KardexEntity,
          ],
          extra: {
            max: configService.get('database.maxConnections', { infer: true }),
            ssl: configService.get('database.sslEnabled', { infer: true })
              ? {
                  rejectUnauthorized: configService.get('database.rejectUnauthorized', { infer: true }),
                  ca: configService.get('database.ca', { infer: true }) ?? undefined,
                  key: configService.get('database.key', { infer: true }) ?? undefined,
                  cert: configService.get('database.cert', { infer: true }) ?? undefined,
                }
              : undefined,
          },
        }) as DataSourceOptions,
      dataSourceFactory: async (options: DataSourceOptions) => {
        return new DataSource(options).initialize();
      },
    }),
    RoleSeedModule,
    PermissionSeedModule,
    UserSeedModule,
    ConfigSeedModule,
    DemoSeedModule,
  ],
})
export class SeedModule {}
