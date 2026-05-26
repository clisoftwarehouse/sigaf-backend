import ms from 'ms';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomStringGenerator } from '@nestjs/common/utils/random-string-generator.util';
import {
  HttpStatus,
  Injectable,
  BadRequestException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';

import { User } from '../users/domain/user';
import { Session } from '../session/domain/session';
import { AllConfigType } from '@/config/config.type';
import { UsersService } from '../users/users.service';
import { SessionService } from '../session/session.service';
import { NullableType } from '@/common/utils/types/nullable.type';
import { JwtPayloadType, JwtRefreshPayloadType } from './strategies/types';
import { AuthUpdateDto, LoginResponseDto, AuthEmailLoginDto } from './dto';
import { UserEntity } from '../users/infrastructure/persistence/relational/entities/user.entity';

const PIN_BCRYPT_ROUNDS = 8;
const PIN_REGEX = /^\d{4,6}$/;

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService,
    private sessionService: SessionService,
    private configService: ConfigService<AllConfigType>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
  ) {}

  async setSupervisorPin(userId: string, pin: string): Promise<void> {
    if (!PIN_REGEX.test(pin)) {
      throw new BadRequestException('El PIN debe tener entre 4 y 6 dígitos numéricos');
    }
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException({
        status: HttpStatus.UNAUTHORIZED,
        errors: { user: 'userNotFound' },
      });
    }
    user.supervisorPinHash = await bcrypt.hash(pin, PIN_BCRYPT_ROUNDS);
    await this.userRepo.save(user);
  }

  async verifySupervisorPin(args: { userId: string; pin: string }): Promise<{ valid: boolean; userId: string }> {
    if (!PIN_REGEX.test(args.pin)) {
      return { valid: false, userId: args.userId };
    }
    const user = await this.userRepo.findOne({ where: { id: args.userId, isActive: true } });
    if (!user || !user.supervisorPinHash) {
      return { valid: false, userId: args.userId };
    }
    const ok = await bcrypt.compare(args.pin, user.supervisorPinHash);
    return { valid: ok, userId: args.userId };
  }

  /**
   * Devuelve la lista de usuarios activos con PIN seteado. Incluye el hash
   * bcrypt para que el POS pueda verificar offline con `bcryptjs`. El hash
   * sale solo a clientes autenticados (JWT válido) y se cachea en SQLite
   * local del terminal pairing-ed — protección por restricción de acceso
   * físico al PC, no por ocultar el hash (que es bcrypt rounds=10).
   *
   * NO devuelve datos sensibles adicionales (email, role, etc.) — solo lo
   * mínimo para autorizar acciones de supervisor.
   */
  async listSupervisorsWithPin(): Promise<Array<{ id: string; fullName: string; pinHash: string }>> {
    const users = await this.userRepo
      .createQueryBuilder('u')
      .where('u.is_active = true')
      .andWhere('u.supervisor_pin_hash IS NOT NULL')
      .select(['u.id', 'u.fullName', 'u.supervisorPinHash'])
      .getMany();
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      pinHash: u.supervisorPinHash as string,
    }));
  }

  /**
   * Lista de cajeros activos con su hash bcrypt para login offline en el POS.
   * El bootstrap del POS cachea este snapshot en SQLite. Cualquier cajero del
   * sistema puede así iniciar sesión sin internet — el control de acceso real
   * sigue siendo la apiKey del terminal (revocable server-side).
   *
   * Devuelve sólo lo necesario para reconstruir el SigafUser en el AuthContext.
   */
  async listCashiersWithPassword(): Promise<
    Array<{
      id: string;
      email: string | null;
      username: string;
      fullName: string;
      passwordHash: string;
      role: unknown;
    }>
  > {
    const users = await this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.role', 'role')
      .where('u.is_active = true')
      .andWhere('u.password IS NOT NULL')
      .getMany();
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      username: u.username,
      fullName: u.fullName,
      passwordHash: u.password,
      role: u.role ? { id: u.role.id, name: u.role.name } : null,
    }));
  }

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
