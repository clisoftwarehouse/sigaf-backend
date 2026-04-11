import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEnum, IsUUID, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateProductDto {
  @ApiPropertyOptional({ example: '7501234567890', description: 'Código de barras EAN-13' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  ean?: string;

  @ApiPropertyOptional({ example: 'SKU-001', description: 'Código interno' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  internalCode?: string;

  @ApiProperty({ example: 'Acetaminofén 500mg x 20 tabletas', description: 'Descripción del producto' })
  @IsString()
  @MaxLength(300)
  description: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  shortName?: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la categoría' })
  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    example: 'pharmaceutical',
    enum: ['general', 'pharmaceutical', 'controlled', 'cosmetic', 'food'],
    description: 'Tipo de producto',
  })
  @IsOptional()
  @IsEnum(['general', 'pharmaceutical', 'controlled', 'cosmetic', 'food'])
  productType?: string;

  @ApiPropertyOptional({ example: false, description: 'Producto controlado (psicotrópico/estupefaciente)' })
  @IsOptional()
  @IsBoolean()
  isControlled?: boolean;

  @IsOptional()
  @IsBoolean()
  isAntibiotic?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Requiere récipe médico' })
  @IsOptional()
  @IsBoolean()
  requiresRecipe?: boolean;

  @IsOptional()
  @IsBoolean()
  isWeighable?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  unitOfMeasure?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  decimalPlaces?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  presentation?: string;

  @ApiPropertyOptional({
    example: 'exempt',
    enum: ['exempt', 'reduced', 'general'],
    description: 'Tipo de IVA (exempt=medicamentos)',
  })
  @IsOptional()
  @IsEnum(['exempt', 'reduced', 'general'])
  taxType?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMin?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockMax?: number;
}
