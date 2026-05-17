import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsUUID, IsString, IsOptional } from 'class-validator';

const PRESCRIPTION_STATUSES = ['active', 'partially_dispensed', 'fully_dispensed', 'expired', 'cancelled'] as const;

export class QueryPrescriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiPropertyOptional({ enum: PRESCRIPTION_STATUSES })
  @IsOptional()
  @IsEnum(PRESCRIPTION_STATUSES)
  status?: (typeof PRESCRIPTION_STATUSES)[number];

  @ApiPropertyOptional({ description: 'Búsqueda por número de récipe o nombre del médico' })
  @IsOptional()
  @IsString()
  search?: string;

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
