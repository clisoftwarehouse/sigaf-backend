import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Max,
  Min,
  IsEnum,
  IsEmail,
  Matches,
  IsNumber,
  IsString,
  IsBoolean,
  MaxLength,
  IsOptional,
} from 'class-validator';

import {
  PHONE_HINT,
  PHONE_REGEX,
  normalizeRif,
  normalizePhone,
  SUPPLIER_RIF_HINT,
  SUPPLIER_RIF_REGEX,
} from '@/common/utils/venezuelan-id';

export class CreateSupplierDto {
  @ApiProperty({ example: 'J-12345678-0', description: 'RIF del proveedor' })
  @IsString()
  @Transform(({ value }) => normalizeRif(value))
  @Matches(SUPPLIER_RIF_REGEX, { message: SUPPLIER_RIF_HINT })
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

  @ApiPropertyOptional({
    enum: ['USD', 'VES'],
    example: 'USD',
    description:
      'Moneda en que el proveedor emite sus facturas. Pre-selecciona la moneda en el formulario de recepción. Default: USD.',
  })
  @IsOptional()
  @IsEnum(['USD', 'VES'])
  invoicesInCurrency?: 'USD' | 'VES';

  // ─── Descuentos comerciales (BI) ───────────────────────────────────────
  @ApiPropertyOptional({ description: '¿El proveedor ofrece descuento de cabecera (sobre subtotal)?' })
  @IsOptional()
  @IsBoolean()
  hasHeaderDiscount?: boolean;

  @ApiPropertyOptional({ description: '% típico de descuento de cabecera' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  headerDiscountPct?: number;

  @ApiPropertyOptional({ description: '¿El proveedor ofrece descuento lineal (por línea)?' })
  @IsOptional()
  @IsBoolean()
  hasLinearDiscount?: boolean;

  @ApiPropertyOptional({ description: '% típico de descuento lineal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  linearDiscountPct?: number;

  @ApiPropertyOptional({ description: '¿El proveedor ofrece descuento por pronto pago?' })
  @IsOptional()
  @IsBoolean()
  hasPromptPaymentDiscount?: boolean;

  @ApiPropertyOptional({ description: '% típico de descuento por pronto pago' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  promptPaymentDiscountPct?: number;

  @ApiPropertyOptional({ description: '¿El proveedor ofrece descuento por volumen?' })
  @IsOptional()
  @IsBoolean()
  hasVolumeDiscount?: boolean;

  @ApiPropertyOptional({ description: '% típico de descuento por volumen' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  volumeDiscountPct?: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Umbral a partir del cual el descuento por volumen aplica. Tipo definido en volumeDiscountThresholdType.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  volumeDiscountThreshold?: number;

  @ApiPropertyOptional({
    enum: ['quantity', 'amount'],
    description: 'quantity = suma de cantidades; amount = subtotal en USD',
  })
  @IsOptional()
  @IsEnum(['quantity', 'amount'])
  volumeDiscountThresholdType?: 'quantity' | 'amount';
}
