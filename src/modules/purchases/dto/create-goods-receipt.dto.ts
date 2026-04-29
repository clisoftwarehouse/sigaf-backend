import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Max,
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
  @ApiPropertyOptional({
    description: 'ID de la orden de compra asociada a este ítem (permite consolidar varias OCs en una factura)',
  })
  @IsOptional()
  @IsUUID()
  purchaseOrderId?: string;

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

  @ApiProperty({ example: 5.0, description: 'Precio de venta en USD (siempre en dólares, nunca en Bs)' })
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiPropertyOptional({ example: 5, description: 'Descuento por línea en %' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discountPct?: number;

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

  @ApiPropertyOptional({ example: 16, description: 'IVA en % aplicado sobre subtotal' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  taxPct?: number;

  @ApiPropertyOptional({ example: 3, description: 'IGTF en % aplicado sobre (subtotal + IVA)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  igtfPct?: number;

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
