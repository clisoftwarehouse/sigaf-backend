import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsArray,
  IsNumber,
  IsString,
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

export class CreateSaleTicketDto {
  @ApiProperty({ description: 'UUID generado por el cliente para deduplicación' })
  @IsUUID()
  clientUuid: string;

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
}
