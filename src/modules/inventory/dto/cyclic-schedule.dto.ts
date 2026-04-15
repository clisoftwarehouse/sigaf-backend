import { Type } from 'class-transformer';
import { ApiProperty, PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  Max,
  IsIn,
  IsInt,
  IsUUID,
  IsArray,
  IsString,
  IsBoolean,
  MaxLength,
  IsOptional,
  IsDateString,
  ArrayNotEmpty,
} from 'class-validator';

export const ABC_CLASSES = ['A', 'B', 'C'] as const;
export const RISK_LEVELS = ['critical', 'sensitive', 'standard'] as const;

export class CreateCyclicScheduleDto {
  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 'Conteo cíclico clase A semanal' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: ['A'], enum: ABC_CLASSES, isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(ABC_CLASSES, { each: true })
  abcClasses: string[];

  @ApiPropertyOptional({ example: ['critical'], enum: RISK_LEVELS, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(RISK_LEVELS, { each: true })
  riskLevels?: string[];

  @ApiPropertyOptional({ example: 7, default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  frequencyDays?: number;

  @ApiPropertyOptional({ example: 50, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxSkusPerCount?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  autoGenerate?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateCyclicScheduleDto extends PartialType(CreateCyclicScheduleDto) {}

export class QueryCyclicScheduleDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;
}

export class QueryAccuracyDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
