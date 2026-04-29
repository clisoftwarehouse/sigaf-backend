import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsEnum,
  IsUUID,
  IsArray,
  Matches,
  IsNumber,
  IsString,
  IsBoolean,
  MaxLength,
  MinLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';

import { CONCENTRATION_HINT, CONCENTRATION_REGEX, normalizeConcentration } from '@/common/utils/concentration';

export class CreateBarcodeDto {
  @ApiProperty({ example: '7501234567890', description: 'Código de barras' })
  @IsString()
  @MaxLength(50)
  barcode: string;

  @ApiPropertyOptional({
    example: 'ean13',
    enum: ['ean13', 'ean8', 'upc', 'internal', 'national', 'international'],
    description: 'Tipo de código de barras',
  })
  @IsOptional()
  @IsEnum(['ean13', 'ean8', 'upc', 'internal', 'national', 'international'])
  barcodeType?: string;

  @ApiPropertyOptional({ example: true, description: 'Código principal del producto' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateProductIngredientDto {
  @ApiProperty({ description: 'ID del principio activo' })
  @IsUUID()
  activeIngredientId: string;

  @ApiPropertyOptional({ example: '500 mg', description: 'Concentración (número + unidad)' })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizeConcentration(value)))
  @IsString()
  @Matches(CONCENTRATION_REGEX, { message: CONCENTRATION_HINT })
  @MaxLength(50)
  concentration?: string;

  @ApiPropertyOptional({ example: true, description: 'Principio activo principal' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateProductDto {
  @ApiPropertyOptional({
    example: 'PROD-000001',
    description:
      'Código interno del producto. Si se omite, se autogenera con el formato `PROD-XXXXXX` usando la secuencia `products_internal_code_seq`.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  internalCode?: string;

  @ApiProperty({ example: 'Acetaminofén 500mg x 20 tabletas', description: 'Descripción completa del producto' })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  description: string;

  @ApiPropertyOptional({ example: 'Acetaminofén 500mg', description: 'Nombre corto del producto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la categoría' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ description: 'ID de la marca' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    example: 'pharmaceutical',
    enum: ['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'],
    description: 'Tipo de producto',
  })
  @IsOptional()
  @IsEnum(['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'])
  productType?: string;

  @ApiPropertyOptional({ example: 'E.F. 12345', description: 'Registro SENCAMER (CPE)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sencamerRegistration?: string;

  @ApiPropertyOptional({ example: false, description: 'Producto controlado (psicotrópico/estupefaciente)' })
  @IsOptional()
  @IsBoolean()
  isControlled?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Es antibiótico' })
  @IsOptional()
  @IsBoolean()
  isAntibiotic?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Requiere récipe médico' })
  @IsOptional()
  @IsBoolean()
  requiresRecipe?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Producto pesable' })
  @IsOptional()
  @IsBoolean()
  isWeighable?: boolean;

  @ApiPropertyOptional({
    example: 'UND',
    enum: ['UND', 'KG', 'G', 'L', 'ML'],
    description: 'Unidad de medida',
  })
  @IsOptional()
  @IsEnum(['UND', 'KG', 'G', 'L', 'ML'])
  unitOfMeasure?: string;

  @ApiPropertyOptional({ example: 0, description: 'Decimales permitidos (0=unidades, 3=pesables)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  decimalPlaces?: number;

  @ApiPropertyOptional({ example: 'Caja x 30 tabletas', description: 'Presentación del producto' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  presentation?: string;

  @ApiPropertyOptional({
    example: 'exempt',
    enum: ['exempt', 'general', 'reduced'],
    description: 'Tipo de IVA (exempt=medicamentos, general=16%, reduced=8%)',
  })
  @IsOptional()
  @IsEnum(['exempt', 'general', 'reduced'])
  taxType?: string;

  @ApiPropertyOptional({ example: 5.5, description: 'Precio Máximo de Venta al Público (regulado)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  pmvp?: number;

  @ApiPropertyOptional({
    example: 'ambient',
    enum: ['ambient', 'cold_chain', 'frozen'],
    description: 'Tipo de conservación',
  })
  @IsOptional()
  @IsEnum(['ambient', 'cold_chain', 'frozen'])
  conservationType?: string;

  @ApiPropertyOptional({ example: 2.0, description: 'Temperatura mínima de conservación (°C)' })
  @IsOptional()
  @IsNumber()
  minTemperature?: number;

  @ApiPropertyOptional({ example: 8.0, description: 'Temperatura máxima de conservación (°C)' })
  @IsOptional()
  @IsNumber()
  maxTemperature?: number;

  @ApiPropertyOptional({ example: 10, description: 'Stock mínimo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMin?: number;

  @ApiPropertyOptional({ example: 100, description: 'Stock máximo' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMax?: number;

  @ApiPropertyOptional({ example: 20, description: 'Punto de reorden' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  reorderPoint?: number;

  @ApiPropertyOptional({ example: 3, description: 'Días de entrega estimados (lead time)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  leadTimeDays?: number;

  @ApiPropertyOptional({
    type: [CreateBarcodeDto],
    description: 'Códigos de barra del producto (EAN-13, EAN-8, UPC, internos, etc.)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateBarcodeDto)
  barcodes?: CreateBarcodeDto[];

  @ApiPropertyOptional({
    type: [CreateProductIngredientDto],
    description: 'Principios activos del producto',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateProductIngredientDto)
  activeIngredients?: CreateProductIngredientDto[];
}
