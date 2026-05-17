import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';

import { AuthService } from './auth.service';
import { MailModule } from '../mail/mail.module';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { SessionModule } from '../session/session.module';
import { JwtStrategy, AnonymousStrategy, JwtRefreshStrategy } from './strategies';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

@Module({
  imports: [
    UsersModule,
    SessionModule,
    PassportModule,
    MailModule,
    JwtModule.register({}),
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtRefreshStrategy, AnonymousStrategy],
  exports: [AuthService],
})
export class AuthModule {}
