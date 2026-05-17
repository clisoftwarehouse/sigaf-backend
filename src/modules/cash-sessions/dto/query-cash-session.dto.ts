import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsOptional, IsDateString } from 'class-validator';

const STATUSES = ['open', 'closed', 'audited'] as const;

export class QueryCashSessionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  terminalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ description: 'Sesiones abiertas o cerradas DESDE (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'Sesiones abiertas o cerradas HASTA (ISO 8601)' })
  @IsOptional()
  @IsDateString()
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
