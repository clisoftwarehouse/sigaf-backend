import { Type } from 'class-transformer';
import { Min, IsInt, IsEnum, IsUUID, IsString, IsBoolean, IsOptional } from 'class-validator';

export class QueryProductDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsEnum(['general', 'pharmaceutical', 'controlled', 'cosmetic', 'food'])
  productType?: string;

  @IsOptional()
  @IsEnum(['exempt', 'reduced', 'general'])
  taxType?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
