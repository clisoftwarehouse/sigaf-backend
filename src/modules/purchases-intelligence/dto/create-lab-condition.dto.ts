import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, Max, IsUUID, IsNumber, IsString, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateLabConditionDto {
  @ApiProperty({ description: 'Laboratorio (debe ser un brand con isLaboratory=true)' })
  @IsUUID()
  brandId: string;

  @ApiPropertyOptional({
    description: 'Si se setea, la condición solo aplica cuando se compra este laboratorio a través de esta droguería.',
  })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'Si se setea, limita la condición a un SKU específico del laboratorio.',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 5, description: 'Descuento lineal (%) — aplica siempre' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  linealPct?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Descuento por escala (%) — aplica cuando se supera `escalaMinUnits`',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  escalaPct?: number;

  @ApiPropertyOptional({ description: 'Umbral mínimo de unidades para activar la escala' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  escalaMinUnits?: number;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  validFrom?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  validTo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
