import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsOptional, IsDateString } from 'class-validator';

const STATUSES = ['finalized', 'voided'] as const;
const TYPES = ['sale', 'return'] as const;

export class QuerySaleTicketDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  terminalId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  cashSessionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsEnum(STATUSES)
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ enum: TYPES })
  @IsOptional()
  @IsEnum(TYPES)
  type?: (typeof TYPES)[number];

  @ApiPropertyOptional({ description: 'ISO 8601' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO 8601' })
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
