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

import {
  DiscrepancyReason,
  DISCREPANCY_REASONS,
} from '../infrastructure/persistence/relational/entities/goods-receipt-item-discrepancy.entity';

export class DiscrepancyInputDto {
  @ApiProperty({ enum: DISCREPANCY_REASONS, description: 'Razón de la discrepancia' })
  @IsEnum(DISCREPANCY_REASONS)
  reason: DiscrepancyReason;

  @ApiProperty({ example: 3, description: 'Cantidad afectada por esta razón' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({ description: 'Notas adicionales (obligatorio si reason=other)' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

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

  @ApiProperty({ example: 100, description: 'Cantidad recibida físicamente en sucursal' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({
    example: 100,
    description:
      'Cantidad que dice la factura del proveedor. Si difiere de `quantity` se generan ' +
      'discrepancias. Default = `quantity` si se omite.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  invoicedQuantity?: number;

  @ApiPropertyOptional({
    type: [DiscrepancyInputDto],
    description: 'Discrepancias por línea. La suma de cantidades debe coincidir con |invoicedQuantity - quantity|.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DiscrepancyInputDto)
  discrepancies?: DiscrepancyInputDto[];

  @ApiProperty({ example: 2.5, description: 'Costo unitario USD' })
  @IsNumber()
  @Min(0)
  unitCostUsd: number;

  @ApiPropertyOptional({
    example: 5.0,
    description:
      'Precio de venta en USD. OPCIONAL — si se omite, el lote se crea sin precio publicado y ' +
      'la fijación queda a cargo del módulo de Precios (fuente de verdad para pricing).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

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

  @ApiPropertyOptional({
    enum: ['USD', 'VES'],
    example: 'USD',
    description:
      'Moneda original de la factura física. Si es VES, `nativeTotal` es obligatorio; ' +
      '`exchangeRateUsed` es opcional (si se omite, se resuelve la última tasa BCV). Default: USD.',
  })
  @IsOptional()
  @IsEnum(['USD', 'VES'])
  nativeCurrency?: 'USD' | 'VES';

  @ApiPropertyOptional({
    example: 3650.0,
    description: 'Total que dice la factura en moneda nativa (Bs. cuando nativeCurrency=VES).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  nativeTotal?: number;

  @ApiPropertyOptional({
    example: 36.5,
    description:
      'Tasa de cambio Bs./USD a aplicar. Si se omite y nativeCurrency=VES, ' +
      'el backend resuelve la última tasa BCV registrada.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  exchangeRateUsed?: number;

  @ApiProperty({ type: [CreateGoodsReceiptItemDto], description: 'Ítems recibidos' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptItemDto)
  items: CreateGoodsReceiptItemDto[];
}
