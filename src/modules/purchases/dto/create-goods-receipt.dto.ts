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

export class CreateGoodsReceiptItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'LOT-2026-001', description: 'Número de lote' })
  @IsString()
  @MaxLength(50)
  lotNumber: string;

  @ApiProperty({ example: '2027-06-30', description: 'Fecha de vencimiento' })
  @IsString()
  expirationDate: string;

  @ApiProperty({ example: 100, description: 'Cantidad recibida' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 2.5, description: 'Costo unitario USD' })
  @IsNumber()
  @Min(0)
  unitCostUsd: number;

  @ApiProperty({ example: 5.0, description: 'Precio de venta' })
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional({ description: 'ID de ubicación en almacén' })
  @IsOptional()
  @IsUUID()
  locationId?: string;
}

export class CreateGoodsReceiptDto {
  @ApiProperty({ description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ description: 'ID de la orden de compra (si aplica)' })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

  @ApiPropertyOptional({ example: 'FAC-001', description: 'Número de factura del proveedor' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  supplierInvoiceNumber?: string;

  @ApiPropertyOptional({
    example: 'purchase',
    enum: ['purchase', 'consignment'],
    description: 'Tipo de recepción',
  })
  @IsOptional()
  @IsEnum(['purchase', 'consignment'])
  receiptType?: string;

  @ApiPropertyOptional({ description: 'Notas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreateGoodsReceiptItemDto], description: 'Ítems recibidos' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}
