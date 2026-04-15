import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, Max, IsUUID, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateSupplierProductDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ example: 'SKU-LAB-1234' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierSku?: string;

  @ApiPropertyOptional({ example: 12.5, description: 'Costo en USD' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  costUsd?: number;

  @ApiPropertyOptional({ example: 5.0, description: 'Descuento porcentual' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPct?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;
}
