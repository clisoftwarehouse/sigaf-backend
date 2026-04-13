import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsString, IsOptional } from 'class-validator';

export class QueryPurchaseOrderDto {
  @ApiPropertyOptional({ description: 'Filtrar por sucursal' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Filtrar por proveedor' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: ['draft', 'sent', 'partial', 'complete', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'partial', 'complete', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ enum: ['purchase', 'consignment'] })
  @IsOptional()
  @IsEnum(['purchase', 'consignment'])
  orderType?: string;

  @ApiPropertyOptional({ description: 'Fecha desde (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Fecha hasta (YYYY-MM-DD)' })
  @IsOptional()
  @IsString()
  to?: string;

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
