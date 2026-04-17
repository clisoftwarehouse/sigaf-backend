import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsArray, IsNumber, IsString, MaxLength, IsOptional, ValidateNested } from 'class-validator';

export class CreateConsignmentEntryItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'LOT-CONS-001', description: 'Número de lote' })
  @IsString()
  @MaxLength(50)
  lotNumber: string;

  @ApiProperty({ example: '2027-06-30', description: 'Fecha de vencimiento' })
  @IsString()
  expirationDate: string;

  @ApiProperty({ example: 50, description: 'Cantidad consignada' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 2.5, description: 'Costo unitario USD' })
  @IsNumber()
  @Min(0)
  costUsd: number;

  @ApiProperty({ example: 5.0, description: 'Precio de venta sugerido en USD (siempre en dólares, nunca en Bs)' })
  @IsNumber()
  @Min(0)
  salePrice: number;
}

export class CreateConsignmentEntryDto {
  @ApiProperty({ description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'ID del proveedor (droguería)' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ example: 15.0, description: 'Porcentaje de comisión' })
  @IsNumber()
  @Min(0)
  commissionPct: number;

  @ApiPropertyOptional({ description: 'Notas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreateConsignmentEntryItemDto], description: 'Ítems consignados' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateConsignmentEntryItemDto)
  items: CreateConsignmentEntryItemDto[];
}
