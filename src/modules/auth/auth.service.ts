import ms from 'ms';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import { HttpStatus, Injectable, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';

import { User } from '../users/domain/user';
import { Session } from '../session/domain/session';
import { AllConfigType } from '@/config/config.type';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { NullableType } from '@/common/utils/types/nullable.type';
import { JwtPayloadType, JwtRefreshPayloadType } from './strategies/types';
import { AuthUpdateDto, LoginResponseDto, AuthEmailLoginDto } from './dto';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private configService: ConfigService<AllConfigType>,
  ) {}

  async validateLogin(loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    const user = await this.usersService.findByEmailOrUsername(loginDto.email);

    if (!user || !user.password) {
      throw new UnauthorizedException({
        status: HttpStatus.UNAUTHORIZED,
        errors: { credentials: 'invalidCredentials' },
      });
    }

    if (!user.isActive) {
      throw new UnauthorizedException({
        status: HttpStatus.UNAUTHORIZED,
        errors: { credentials: 'userInactive' },
      });
    }

    const isValidPassword = await bcrypt.compare(loginDto.password, user.password);

    if (!isValidPassword) {
      throw new UnauthorizedException({
        status: HttpStatus.UNAUTHORIZED,
        errors: { credentials: 'invalidCredentials' },
      });
    }

    const hash = crypto.createHash('sha256').update(randomStringGenerator()).digest('hex');

    const tokenExpiresIn = this.configService.getOrThrow('auth.refreshExpires', { infer: true });
    const expiresAt = new Date(Date.now() + ms(tokenExpiresIn));

    const session = await this.sessionService.create({
      userId: user.id,
      user,
      hash,
      ipAddress: null,
      terminalId: null,
      expiresAt,
      createdAt: new Date(),
    } as Session);

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: user.id,
      role: user.role,
      sessionId: session.id,
      hash,
    });

    return {
      refreshToken,
      token,
      tokenExpires,
      user,
    };
  }

  async me(userJwtPayload: JwtPayloadType): Promise<NullableType<User>> {
    return this.usersService.findById(userJwtPayload.id);
  }

  async update(userJwtPayload: JwtPayloadType, userDto: AuthUpdateDto): Promise<NullableType<User>> {
    const currentUser = await this.usersService.findById(userJwtPayload.id);

    if (!currentUser) {
      throw new UnprocessableEntityException({
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        errors: { user: 'userNotFound' },
      });
    }

    if (userDto.password) {
      if (!userDto.oldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { oldPassword: 'missingOldPassword' },
        });
      }

      if (!currentUser.password) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { oldPassword: 'incorrectOldPassword' },
        });
      }

      const isValidOldPassword = await bcrypt.compare(userDto.oldPassword, currentUser.password);

      if (!isValidOldPassword) {
        throw new UnprocessableEntityException({
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          errors: { oldPassword: 'incorrectOldPassword' },
        });
      } else {
        await this.sessionService.deleteByUserIdWithExclude({
          userId: currentUser.id,
          excludeSessionId: userJwtPayload.sessionId,
        });
      }
    }

    delete userDto.oldPassword;

    await this.usersService.update(userJwtPayload.id, userDto);

    return this.usersService.findById(userJwtPayload.id);
  }

  async refreshToken(data: Pick<JwtRefreshPayloadType, 'sessionId' | 'hash'>): Promise<Omit<LoginResponseDto, 'user'>> {
    const session = await this.sessionService.findById(data.sessionId);

    if (!session) {
      throw new UnauthorizedException();
    }

    if (session.hash !== data.hash) {
      throw new UnauthorizedException();
    }

    const hash = crypto.createHash('sha256').update(randomStringGenerator()).digest('hex');

    const user = await this.usersService.findById(session.user.id);

    if (!user?.role) {
      throw new UnauthorizedException();
    }

    await this.sessionService.update(session.id, { hash });

    const { token, refreshToken, tokenExpires } = await this.getTokensData({
      id: session.user.id,
      role: user.role,
      sessionId: session.id,
      hash,
    });

    return { token, refreshToken, tokenExpires };
  }

  async softDelete(user: User): Promise<void> {
    await this.usersService.remove(user.id);
  }

  async logout(data: Pick<JwtRefreshPayloadType, 'sessionId'>) {
    return this.sessionService.deleteById(data.sessionId);
  }

  private async getTokensData(data: {
    id: User['id'];
    role: User['role'];
    sessionId: Session['id'];
    hash: Session['hash'];
  }) {
    const tokenExpiresIn = this.configService.getOrThrow('auth.expires', { infer: true });
    const tokenExpires = Date.now() + ms(tokenExpiresIn);

    const [token, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { id: data.id, role: data.role, sessionId: data.sessionId },
        { secret: this.configService.getOrThrow('auth.secret', { infer: true }), expiresIn: tokenExpiresIn },
      ),
      this.jwtService.signAsync(
        { sessionId: data.sessionId, hash: data.hash },
        {
          secret: this.configService.getOrThrow('auth.refreshSecret', { infer: true }),
          expiresIn: this.configService.getOrThrow('auth.refreshExpires', { infer: true }),
        },
      ),
    ]);

    return { token, refreshToken, tokenExpires };
  }
}
