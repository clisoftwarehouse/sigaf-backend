import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, Matches, IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';

import { RoleDto } from '../../roles/dto/role.dto';
import { lowerCaseTransformer } from '@/common/utils/transformers/lower-case.transformer';
import {
  PHONE_HINT,
  CEDULA_HINT,
  PHONE_REGEX,
  CEDULA_REGEX,
  normalizePhone,
  normalizeCedula,
} from '@/common/utils/venezuelan-id';

export class CreateUserDto {
  @ApiProperty({ example: 'admin', type: String })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'secret123', type: String })
  @MinLength(6)
  password?: string;

  @ApiProperty({ example: 'Juan Pérez', type: String })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: 'V-12345678', type: String })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizeCedula(value)))
  @IsString()
  @Matches(CEDULA_REGEX, { message: CEDULA_HINT })
  cedula?: string | null;

  @ApiPropertyOptional({ example: 'admin@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '+584121234567', type: String })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizePhone(value)))
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_HINT })
  phone?: string | null;

  @ApiPropertyOptional({ type: RoleDto })
  @IsOptional()
  @Type(() => RoleDto)
  role?: RoleDto | null;
}
