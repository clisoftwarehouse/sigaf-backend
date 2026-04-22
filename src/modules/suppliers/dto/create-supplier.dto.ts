import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEmail, Matches, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

import {
  RIF_HINT,
  PHONE_HINT,
  RIF_REGEX,
  PHONE_REGEX,
  normalizeRif,
  normalizePhone,
} from '@/common/utils/venezuelan-id';

export class CreateSupplierDto {
  @ApiProperty({ example: 'J-12345678-0', description: 'RIF del proveedor' })
  @IsString()
  @Transform(({ value }) => normalizeRif(value))
  @Matches(RIF_REGEX, { message: RIF_HINT })
  @MaxLength(20)
  rif: string;

  @ApiProperty({ example: 'Distribuidora Farmacéutica ABC', description: 'Razón social' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'businessName no puede estar vacío ni contener solo espacios' })
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional({ example: 'DFA', description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizePhone(value)))
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_HINT })
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true, description: 'Indica si es droguería con API B2B' })
  @IsOptional()
  @IsBoolean()
  isDrugstore?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'Días de crédito' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consignmentCommissionPct?: number;
}
