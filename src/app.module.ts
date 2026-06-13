import path from 'path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { SalesModule } from './modules/sales/sales.module';
import fileConfig from './modules/files/config/file.config';
import { BrandsModule } from './modules/brands/brands.module';
import { ClaimsModule } from './modules/claims/claims.module';
import { PricesModule } from './modules/prices/prices.module';
import databaseConfig from './database/config/database.config';
import { SessionModule } from './modules/session/session.module';
import { ImportsModule } from './modules/imports/imports.module';
import { BranchesModule } from './modules/branches/branches.module';
import { ProductsModule } from './modules/products/products.module';
import { CustomersModule } from './modules/customers/customers.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { TerminalsModule } from './modules/terminals/terminals.module';
import { PurchasesModule } from './modules/purchases/purchases.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { LibrosIvaModule } from './modules/libros-iva/libros-iva.module';
import { WarehousesModule } from './modules/warehouses/warehouses.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { IdempotencyModule } from './modules/idempotency/idempotency.module';
import { PrescribersModule } from './modules/prescribers/prescribers.module';
import { ConsignmentsModule } from './modules/consignments/consignments.module';
import { BranchGroupsModule } from './modules/branch-groups/branch-groups.module';
import { ConfigGlobalModule } from './modules/config-global/config-global.module';
import { CashSessionsModule } from './modules/cash-sessions/cash-sessions.module';
import { PrescriptionsModule } from './modules/prescriptions/prescriptions.module';
import { ExchangeRatesModule } from './modules/exchange-rates/exchange-rates.module';
import { EmissionPluginsModule } from './modules/emission-plugins/emission-plugins.module';
import { TherapeuticUsesModule } from './modules/therapeutic-uses/therapeutic-uses.module';
import { AccountsPayableModule } from './modules/accounts-payable/accounts-payable.module';
import { DocumentEmissionModule } from './modules/document-emission/document-emission.module';
import { ActiveIngredientsModule } from './modules/active-ingredients/active-ingredients.module';
import { InventoryTransfersModule } from './modules/inventory-transfers/inventory-transfers.module';
import { PurchasesComparatorModule } from './modules/purchases-comparator/purchases-comparator.module';
import { CommercialTaxonomiesModule } from './modules/commercial-taxonomies/commercial-taxonomies.module';
import { PurchasesIntelligenceModule } from './modules/purchases-intelligence/purchases-intelligence.module';

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
    ScheduleModule.forRoot(),
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
    WarehousesModule,
    CategoriesModule,
    BrandsModule,
    CommercialTaxonomiesModule,
    SuppliersModule,
    ProductsModule,
    TerminalsModule,
    ExchangeRatesModule,
    PricesModule,
    PromotionsModule,
    InventoryTransfersModule,
    ConfigGlobalModule,
    PurchasesModule,
    PurchasesComparatorModule,
    PurchasesIntelligenceModule,
    AccountsPayableModule,
    PrescribersModule,
    LibrosIvaModule,
    ClaimsModule,
    ConsignmentsModule,
    ActiveIngredientsModule,
    TherapeuticUsesModule,
    BranchGroupsModule,
    PermissionsModule,
    RolesModule,
    ImportsModule,
    CustomersModule,
    PrescriptionsModule,
    CashSessionsModule,
    IdempotencyModule,
    SalesModule,
    DocumentEmissionModule,
    EmissionPluginsModule.register(),
  ],
})
export class AppModule {}
