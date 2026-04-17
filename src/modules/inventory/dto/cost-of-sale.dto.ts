import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';

/**
 * Preview de consumo FEFO para una venta (o cualquier salida de stock por lote).
 * No persiste — solo calcula qué lotes se consumirían y cuál sería el COGS.
 */
export class QueryCostOfSalePreviewDto {
  @ApiProperty({ example: 'uuid', description: 'ID del producto a vender' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 3, description: 'Cantidad a consumir (unidades)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

/**
 * Ejecuta consumo FEFO: decrementa `quantity_available`, incrementa `quantity_sold`
 * y registra asientos de kardex por cada lote afectado.
 */
export class ConsumeFefoDto {
  @ApiProperty({ example: 'uuid', description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 3, description: 'Cantidad a consumir' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({
    example: 'sale',
    description: 'Tipo de referencia del movimiento (ej: sale, transfer_out, manual_sale)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'ID de la entidad origen (venta, traslado, etc.)' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({
    example: 12.5,
    description:
      'Precio de venta unitario en USD (opcional). Si se proporciona, la respuesta incluye `marginUsd` y `marginPct`. ' +
      'Para resolver el precio vigente del producto consulta primero `GET /prices/current` (módulo Prices).',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePriceUsd?: number;

  @ApiPropertyOptional({ example: 'Venta POS ticket #123' })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Revierte (parcial o totalmente) un consumo previo sobre un lote específico.
 * Usado para devoluciones de ventas.
 */
export class ReturnToLotDto {
  @ApiProperty({ example: 'uuid', description: 'ID del lote al que se devuelve la mercancía' })
  @IsUUID()
  lotId: string;

  @ApiProperty({ example: 1, description: 'Cantidad devuelta (positiva)' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({
    example: 'sale_return',
    description: 'Tipo de referencia (sale_return, transfer_in_return, etc.)',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'ID de la entidad origen de la devolución' })
  @IsOptional()
  @IsUUID()
  referenceId?: string;

  @ApiPropertyOptional({ example: 'Cliente devolvió producto sin abrir' })
  @IsOptional()
  @IsString()
  notes?: string;
}
