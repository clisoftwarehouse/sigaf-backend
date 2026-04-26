import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEnum, IsUUID, IsString, IsOptional } from 'class-validator';

export class QueryClaimsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  receiptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: ['quality', 'quantity', 'price_mismatch', 'other'] })
  @IsOptional()
  @IsEnum(['quality', 'quantity', 'price_mismatch', 'other'])
  claimType?: string;

  @ApiPropertyOptional({ enum: ['open', 'in_progress', 'resolved', 'rejected'] })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'rejected'])
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number;
}
