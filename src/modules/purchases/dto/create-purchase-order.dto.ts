import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsEnum,
  IsUUID,
  IsArray,
  IsNumber,
  IsString,
  MaxLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 10, description: 'Cantidad' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 2.5, description: 'Costo unitario USD' })
  @IsNumber()
  @Min(0)
  unitCostUsd: number;

  @ApiPropertyOptional({ example: 5, description: 'Porcentaje de descuento' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discountPct?: number;
}

export class CreatePurchaseOrderDto {
  @ApiProperty({ description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({
    example: 'purchase',
    enum: ['purchase', 'consignment'],
    description: 'Tipo de orden',
  })
  @IsOptional()
  @IsEnum(['purchase', 'consignment'])
  orderType?: string;

  @ApiPropertyOptional({ example: '2026-05-01', description: 'Fecha esperada de entrega' })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Notas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreatePurchaseOrderItemDto], description: 'Ítems de la orden' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items: CreatePurchaseOrderItemDto[];
}
