import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsArray,
  Matches,
  IsNumber,
  IsString,
  MaxLength,
  IsOptional,
  ArrayMinSize,
  IsDateString,
  ValidateNested,
} from 'class-validator';

const PAYMENT_METHODS = ['EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL', 'TDD', 'TDC', 'ZELLE', 'OTRO'] as const;

export class CreateSaleTicketItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 2, description: 'Cantidad' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;

  @ApiPropertyOptional({
    description: 'Descuento manual sobre la línea (0..100). Si se omite usa el descuento por promoción/cliente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  discountPercent?: number;

  @ApiPropertyOptional({
    description: 'ID del prescription_item cuando el producto requiere récipe. Obligatorio si product.requiresRecipe.',
  })
  @IsOptional()
  @IsUUID()
  prescriptionItemId?: string;
}

export class CreateSaleTicketPaymentDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsEnum(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0.0001)
  amountUsd: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amountBs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  referenceNumber?: string;

  @ApiPropertyOptional({ minLength: 4, maxLength: 4 })
  @IsOptional()
  @IsString()
  cardLast4?: string;
}

/**
 * Documento emitido localmente por el POS (ej. factura fiscal HKA). Viaja con
 * el ticket; el backend lo registra como `sale_document`. Naming neutro: es un
 * documento de emisión, sin semántica fiscal/no-fiscal en el contrato.
 */
export class EmittedDocumentDto {
  @ApiProperty({ description: 'Key del método de emisión (ej. hka_fiscal)' })
  @IsString()
  @MaxLength(50)
  methodKey: string;

  @ApiProperty({ description: 'Tipo de documento (ej. hka_fiscal)' })
  @IsString()
  @MaxLength(50)
  documentType: string;

  @ApiPropertyOptional({ description: 'Número de documento / factura fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  documentNumber?: string;

  @ApiPropertyOptional({ description: 'Número de control fiscal' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  controlNumber?: string;

  @ApiPropertyOptional({ enum: ['emitted', 'failed', 'voided'], default: 'emitted' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Respuesta cruda del emisor (diagnóstico)' })
  @IsOptional()
  rawResponse?: Record<string, unknown>;
}

export class CreateSaleTicketDto {
  @ApiProperty({ description: 'UUID generado por el cliente para deduplicación' })
  @IsUUID()
  clientUuid: string;

  @ApiPropertyOptional({
    description:
      'UUID del usuario cajero que cerró la venta. Lo manda el POS porque, en modo offline, ' +
      'el JWT del backend puede no estar disponible — la apiKey del terminal autentica el equipo y este campo identifica al operador. ' +
      'Opcional para compatibilidad con payloads antiguos encolados antes del schema change.',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiProperty()
  @IsUUID()
  cashSessionId: string;

  @ApiProperty()
  @IsUUID()
  terminalId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional({ description: 'Cliente; null = mostrador' })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({
    description: 'Tasa USD→Bs usada para esta venta. Persistida con la venta.',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRateUsdBs: number;

  @ApiPropertyOptional({ description: 'ISO 8601, hora de creación local del POS' })
  @IsOptional()
  @IsDateString()
  clientCreatedAt?: string;

  @ApiPropertyOptional({
    description:
      'Número provisional asignado por el POS al cerrar offline (`T1-001`). Único globalmente. Si se omite, el ticket no tiene número visible para el cliente además del ticket_number del backend.',
    example: 'T1-001',
  })
  @IsOptional()
  @IsString()
  @Matches(/^T[A-Z0-9]{1,3}-\d{1,6}$/, {
    message: 'provisionalNumber debe seguir el formato T{code}-{n} (ej. T1-001)',
  })
  provisionalNumber?: string;

  @ApiProperty({ type: [CreateSaleTicketItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleTicketItemDto)
  items: CreateSaleTicketItemDto[];

  @ApiProperty({ type: [CreateSaleTicketPaymentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleTicketPaymentDto)
  payments: CreateSaleTicketPaymentDto[];

  @ApiPropertyOptional({
    type: [EmittedDocumentDto],
    description:
      'Documentos que el POS ya emitió localmente (ej. factura fiscal HKA impresa offline). El backend los registra al persistir el ticket.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmittedDocumentDto)
  emittedDocuments?: EmittedDocumentDto[];
}
