import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsString, IsBoolean, IsOptional } from 'class-validator';

export class QueryProductDto {
  @ApiPropertyOptional({ description: 'Búsqueda por descripción, código interno o código de barras' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filtrar por categoría' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por marca' })
  @IsOptional()
  @IsUUID()
  brandId?: string;

  @ApiPropertyOptional({
    enum: ['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'],
    description: 'Tipo de producto',
  })
  @IsOptional()
  @IsEnum(['pharmaceutical', 'controlled', 'otc', 'grocery', 'miscellaneous', 'weighable'])
  productType?: string;

  @ApiPropertyOptional({ enum: ['exempt', 'general', 'reduced'], description: 'Tipo de IVA' })
  @IsOptional()
  @IsEnum(['exempt', 'general', 'reduced'])
  taxType?: string;

  @ApiPropertyOptional({ description: 'Filtrar por activo/inactivo' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    enum: ['normal', 'low', 'out'],
    description: 'Estado de stock: out=sin stock, low=stock<=stock_min, normal=resto',
  })
  @IsOptional()
  @IsEnum(['normal', 'low', 'out'])
  stockStatus?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
