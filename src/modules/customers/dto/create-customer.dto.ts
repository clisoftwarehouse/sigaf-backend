import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  Max,
  IsEnum,
  IsEmail,
  Matches,
  IsString,
  IsNumber,
  IsBoolean,
  MaxLength,
  MinLength,
  IsOptional,
  IsDateString,
} from 'class-validator';

export const CUSTOMER_DOCUMENT_TYPES = ['V', 'E', 'J', 'G', 'P'] as const;
export const CUSTOMER_TYPES = ['retail', 'frecuente', 'corporativo'] as const;

/**
 * Documento venezolano sin prefijo. Para V/E/J/G aceptamos sólo dígitos
 * (entre 7 y 11). Para P (pasaporte) aceptamos alfanumérico hasta 15.
 */
const DOC_NUMBER_REGEX = /^[A-Za-z0-9]{6,15}$/;

export class CreateCustomerDto {
  @ApiProperty({ enum: CUSTOMER_DOCUMENT_TYPES, example: 'V' })
  @IsEnum(CUSTOMER_DOCUMENT_TYPES)
  documentType: (typeof CUSTOMER_DOCUMENT_TYPES)[number];

  @ApiProperty({ example: '12345678', description: 'Sólo el número/código, sin prefijo' })
  @IsString()
  @Matches(DOC_NUMBER_REGEX, {
    message: 'documentNumber debe ser alfanumérico de 6 a 15 caracteres',
  })
  documentNumber: string;

  @ApiProperty({ example: 'Juan Pérez González' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName: string;

  @ApiPropertyOptional({ example: '+584141234567' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ example: 'cliente@correo.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;

  @ApiPropertyOptional({ example: 'Av. Bolívar, Edif. Centro, Apto 4B' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES, default: 'retail' })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPES)
  customerType?: (typeof CUSTOMER_TYPES)[number];

  @ApiPropertyOptional({ example: 5, description: 'Descuento por defecto 0..100' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  defaultDiscountPercent?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  creditLimitUsd?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'Alergias del paciente (alerta CRM)' })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({ description: 'Condiciones crónicas (diabetes, HTA, etc.)' })
  @IsOptional()
  @IsString()
  chronicConditions?: string;

  @ApiPropertyOptional({ description: 'Fecha de nacimiento (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
