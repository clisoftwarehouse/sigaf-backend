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
          // Cargar todas las entities por glob para evitar errores de relaciones
          // huérfanas cuando se agregan módulos nuevos sin actualizar este array.
          entities: [__dirname + '/../../../**/*.entity{.ts,.js}'],
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
