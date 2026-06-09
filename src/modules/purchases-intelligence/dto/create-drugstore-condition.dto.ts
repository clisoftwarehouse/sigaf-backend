import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, Max, IsUUID, IsNumber, IsString, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class CreateDrugstoreConditionDto {
  @ApiProperty({ description: 'Droguería a la que aplica esta condición' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({
    description: 'Si se setea, la condición aplica SOLO a este producto (override más específico).',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({
    description: 'Si se setea, la condición aplica SOLO a productos de este laboratorio.',
  })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({ example: 5, description: 'Descuento cabecera (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  cabeceraPct?: number;

  @ApiPropertyOptional({ example: 3, description: 'Descuento por volumen (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  volumenPct?: number;

  @ApiPropertyOptional({ example: 2, description: 'Descuento por pronto pago (%)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  prontoPagoPct?: number;

  @ApiPropertyOptional({ description: 'Umbral mínimo USD para activar el descuento de volumen' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumenMinUsd?: number;

  @ApiPropertyOptional({ description: 'Umbral mínimo de unidades para activar el descuento de volumen' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  volumenMinUnits?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  deliveryDays?: number;

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
