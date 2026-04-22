import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, Matches, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

import { PHONE_HINT, PHONE_REGEX, normalizePhone } from '@/common/utils/venezuelan-id';

export class CreateSupplierContactDto {
  @ApiProperty({ example: 'María Pérez' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'fullName no puede estar vacío ni contener solo espacios' })
  @MaxLength(150)
  fullName: string;

  @ApiPropertyOptional({ example: 'Gerente de Ventas' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  role?: string;

  @ApiPropertyOptional({ example: 'Comercial' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizePhone(value)))
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_HINT })
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizePhone(value)))
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_HINT })
  @MaxLength(20)
  mobile?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
