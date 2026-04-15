import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsString, IsOptional, IsDateString } from 'class-validator';

export class QueryAuditDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tableName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  recordId?: string;

  @ApiPropertyOptional({ enum: ['INSERT', 'UPDATE', 'DELETE'] })
  @IsOptional()
  @IsEnum(['INSERT', 'UPDATE', 'DELETE'])
  action?: 'INSERT' | 'UPDATE' | 'DELETE';

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
