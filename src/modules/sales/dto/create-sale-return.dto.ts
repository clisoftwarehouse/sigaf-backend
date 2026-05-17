import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
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

export class CreateSaleReturnItemDto {
  @ApiProperty({ description: 'ID del sale_ticket_item original que se devuelve.' })
  @IsUUID()
  saleTicketItemId: string;

  @ApiProperty({ example: 1, description: 'Cantidad a devolver (≤ cantidad pendiente).' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity: number;
}

export class CreateSaleReturnRefundDto {
  @ApiProperty({ enum: PAYMENT_METHODS })
  @IsEnum(PAYMENT_METHODS)
  paymentMethod: (typeof PAYMENT_METHODS)[number];

  @ApiProperty({ description: 'Monto USD a reembolsar al cliente.' })
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
}

export class CreateSaleReturnDto {
  @ApiProperty({ description: 'UUID generado por el cliente para deduplicar.' })
  @IsUUID()
  clientUuid: string;

  @ApiProperty({ description: 'Ticket original que se devuelve (parcial o total).' })
  @IsUUID()
  referenceTicketId: string;

  @ApiProperty()
  @IsUUID()
  cashSessionId: string;

  @ApiProperty()
  @IsUUID()
  terminalId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'Tasa USD→Bs usada para la nota de crédito.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  @Min(0.000001)
  exchangeRateUsdBs: number;

  @ApiPropertyOptional({ description: 'Motivo de la devolución (legal/auditoría).' })
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional({ description: 'ISO 8601, hora local del POS al crear la devolución.' })
  @IsOptional()
  @IsDateString()
  clientCreatedAt?: string;

  @ApiProperty({ type: [CreateSaleReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnItemDto)
  items: CreateSaleReturnItemDto[];

  @ApiProperty({ type: [CreateSaleReturnRefundDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleReturnRefundDto)
  refunds: CreateSaleReturnRefundDto[];
}
