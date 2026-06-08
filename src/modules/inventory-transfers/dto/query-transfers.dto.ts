import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsEnum, IsNumber, IsOptional, IsDateString } from 'class-validator';

export type TransferStatus = 'draft' | 'in_transit' | 'completed' | 'cancelled';

export class QueryTransfersDto {
  @ApiPropertyOptional({ enum: ['inter_branch', 'intra_branch'] })
  @IsOptional()
  @IsEnum(['inter_branch', 'intra_branch'])
  transferType?: 'inter_branch' | 'intra_branch';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromBranchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toBranchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiPropertyOptional({ enum: ['draft', 'in_transit', 'completed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'in_transit', 'completed', 'cancelled'])
  status?: TransferStatus;

  @ApiPropertyOptional({ description: 'Filtrar por transfer_date >= from' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Filtrar por transfer_date <= to' })
  @IsOptional()
  @IsDateString()
  to?: string;

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
