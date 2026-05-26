import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiOkResponse } from '@nestjs/swagger';
import {
  Get,
  Body,
  Post,
  Patch,
  Delete,
  Request,
  HttpCode,
  UseGuards,
  Controller,
  HttpStatus,
  SerializeOptions,
} from '@nestjs/common';

import { User } from '../users/domain/user';
import { AuthService } from './auth.service';
import { NullableType } from '../../common/utils/types/nullable.type';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';
import { SetPinDto, VerifyPinDto, AuthUpdateDto, LoginResponseDto, AuthEmailLoginDto, RefreshResponseDto } from './dto';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @SerializeOptions({ groups: ['me'] })
  @Post('email/login')
  @ApiOperation({ summary: 'Login con email/username y password' })
  @ApiOkResponse({ type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  public login(@Body() loginDto: AuthEmailLoginDto): Promise<LoginResponseDto> {
    return this.service.validateLogin(loginDto);
  }

  @ApiBearerAuth()
  @SerializeOptions({ groups: ['me'] })
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({
    summary: 'Obtener usuario actual con sus permission codes para gating de UI',
  })
  @ApiOkResponse({ type: User })
  @HttpCode(HttpStatus.OK)
  public me(@Request() request): Promise<NullableType<User & { permissions: string[] }>> {
    return this.service.me(request.user);
  }

  @ApiBearerAuth()
  @ApiOkResponse({ type: RefreshResponseDto })
  @SerializeOptions({ groups: ['me'] })
  @Post('refresh')
  @UseGuards(AuthGuard('jwt-refresh'))
  @ApiOperation({ summary: 'Refrescar token' })
  @HttpCode(HttpStatus.OK)
  public refresh(@Request() request): Promise<RefreshResponseDto> {
    return this.service.refreshToken({
      sessionId: request.user.sessionId,
      hash: request.user.hash,
    });
  }

  @ApiBearerAuth()
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Cerrar sesión' })
  @HttpCode(HttpStatus.NO_CONTENT)
  public async logout(@Request() request): Promise<void> {
    await this.service.logout({ sessionId: request.user.sessionId });
  }

  @ApiBearerAuth()
  @SerializeOptions({ groups: ['me'] })
  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Actualizar perfil' })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ type: User })
  public update(@Request() request, @Body() userDto: AuthUpdateDto): Promise<NullableType<User>> {
    return this.service.update(request.user, userDto);
  }

  @ApiBearerAuth()
  @Delete('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Eliminar cuenta' })
  @HttpCode(HttpStatus.NO_CONTENT)
  public async delete(@Request() request): Promise<void> {
    return this.service.softDelete(request.user);
  }

  @ApiBearerAuth()
  @Patch('me/pin')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Establecer/actualizar mi PIN de supervisor' })
  public async setMyPin(@Request() request, @Body() dto: SetPinDto): Promise<void> {
    await this.service.setSupervisorPin(request.user.id, dto.pin);
  }

  @Post('verify-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Verificar PIN de un supervisor (override en POS: descuento manual, anulación, etc.)',
  })
  public verifyPin(@Body() dto: VerifyPinDto): Promise<{ valid: boolean; userId: string }> {
    return this.service.verifySupervisorPin({ userId: dto.userId, pin: dto.pin });
  }

  @ApiBearerAuth()
  @Get('supervisors')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary:
      'Lista de supervisors con su hash de PIN para cache local del POS (verify offline). ' +
      'Acepta JWT del admin O apiKey del terminal — el hash NO sale del flujo autenticado y se almacena ' +
      'en el SQLite local del POS bound al PC físico vía terminal pairing.',
  })
  public async listSupervisors(): Promise<Array<{ id: string; fullName: string; pinHash: string }>> {
    return this.service.listSupervisorsWithPin();
  }

  @ApiBearerAuth()
  @Get('cashiers')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary:
      'Lista de cajeros activos con su hash de password para login offline del POS. ' +
      'Requiere JWT válido. El hash bcrypt se cachea en SQLite local junto al terminal ' +
      'pairing-ed para que cualquier cajero del sistema pueda iniciar sesión sin internet.',
  })
  public async listCashiers(): Promise<
    Array<{
      id: string;
      email: string | null;
      username: string;
      fullName: string;
      passwordHash: string;
      role: unknown;
    }>
  > {
    return this.service.listCashiersWithPassword();
  }
}
