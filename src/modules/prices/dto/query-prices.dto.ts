import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsNumber, IsBoolean, IsOptional, IsDateString } from 'class-validator';

export class QueryPricesDto {
  @ApiPropertyOptional({ description: 'Filtrar por producto' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Precios vigentes en esa fecha (ISO). Default: ahora. Ignorado si includeHistory=true.',
  })
  @IsOptional()
  @IsDateString()
  activeAt?: string;

  @ApiPropertyOptional({
    description: 'Si true, retorna también precios ya expirados (historial completo).',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeHistory?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class QueryCurrentPriceDto {
  @ApiPropertyOptional({ description: 'ID del producto (requerido)' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'ID de sucursal. Si se provee, se prioriza override por sucursal sobre precio global.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    description: 'Momento de consulta (ISO). Default: ahora (para pricing histórico retroactivo).',
  })
  @IsOptional()
  @IsDateString()
  at?: string;
}
