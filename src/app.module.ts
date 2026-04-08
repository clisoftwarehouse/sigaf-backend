import path from 'path';
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, DataSourceOptions } from 'typeorm';
import { I18nModule, HeaderResolver } from 'nestjs-i18n';
import { ConfigModule, ConfigService } from '@nestjs/config';

import appConfig from './config/app.config';
import { AllConfigType } from './config/config.type';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { HomeModule } from './modules/home/home.module';
import { UsersModule } from './modules/users/users.module';
import { FilesModule } from './modules/files/files.module';
import authConfig from './modules/auth/config/auth.config';
import mailConfig from './modules/mail/config/mail.config';
import fileConfig from './modules/files/config/file.config';
import { MailerModule } from './modules/mailer/mailer.module';
import databaseConfig from './database/config/database.config';
import { SessionModule } from './modules/session/session.module';
import appleConfig from './modules/auth-apple/config/apple.config';
import googleConfig from './modules/auth-google/config/google.config';
import { AuthAppleModule } from './modules/auth-apple/auth-apple.module';
import { TypeOrmConfigService } from './database/typeorm-config.service';
import { AuthGoogleModule } from './modules/auth-google/auth-google.module';

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
      load: [databaseConfig, authConfig, appConfig, mailConfig, fileConfig, googleConfig, appleConfig],
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
    AuthGoogleModule,
    AuthAppleModule,
    SessionModule,
    MailModule,
    MailerModule,
    HomeModule,
  ],
})
export class AppModule {}
