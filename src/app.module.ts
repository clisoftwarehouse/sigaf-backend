import path from 'path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import { ConfigModule, ConfigService } from '@nestjs/config';

import appConfig from './config/app.config';
import { AllConfigType } from './config/config.type';
import { AuthModule } from './modules/auth/auth.module';
import { HomeModule } from './modules/home/home.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import authConfig from './modules/auth/config/auth.config';
import { AuditModule } from './modules/audit/audit.module';
import { RolesModule } from './modules/roles/roles.module';
import fileConfig from './modules/files/config/file.config';
import { BrandsModule } from './modules/brands/brands.module';
import databaseConfig from './database/config/database.config';
import { SessionModule } from './modules/session/session.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ProductsModule } from './modules/products/products.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { LocationsModule } from './modules/locations/locations.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { CategoriesModule } from './modules/categories/categories.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ConsignmentsModule } from './modules/consignments/consignments.module';
import { ConfigGlobalModule } from './modules/config-global/config-global.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { ActiveIngredientsModule } from './modules/active-ingredients/active-ingredients.module';

const infrastructureDatabaseModule = TypeOrmModule.forRootAsync({
  useClass: TypeOrmConfigService,
  dataSourceFactory: async (options: DataSourceOptions) => {
    return new DataSource(options).initialize();
  },
});

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, authConfig, appConfig, fileConfig],
      envFilePath: ['.env'],
    }),
    infrastructureDatabaseModule,
    I18nModule.forRootAsync({
      useFactory: (configService: ConfigService<AllConfigType>) => ({
        fallbackLanguage: configService.getOrThrow('app.fallbackLanguage', {
          infer: true,
        }),
        loaderOptions: { path: path.join(__dirname, '/i18n/'), watch: true },
      }),
      resolvers: [
        {
          use: HeaderResolver,
          useFactory: (configService: ConfigService<AllConfigType>) => {
            return [
              configService.get('app.headerLanguage', {
                infer: true,
              }),
            ];
          },
          inject: [ConfigService],
        },
      ],
      imports: [ConfigModule],
      inject: [ConfigService],
    }),
    UsersModule,
    FilesModule,
    AuthModule,
    SessionModule,
    HomeModule,
    AuditModule,
    InventoryModule,
    BranchesModule,
    LocationsModule,
    CategoriesModule,
    BrandsModule,
    SuppliersModule,
    ProductsModule,
    TerminalsModule,
    ExchangeRatesModule,
    ConfigGlobalModule,
    PurchasesModule,
    ConsignmentsModule,
    ActiveIngredientsModule,
    PermissionsModule,
    RolesModule,
  ],
})
export class AppModule {}
