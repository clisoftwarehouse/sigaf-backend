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
  @ApiPropertyOptional({
    description:
      'ID del sale_ticket_item original. Obligatorio cuando `referenceTicketId` está; opcional cuando la devolución es offline contra un ticket aún no sincronizado (en cuyo caso el backend resuelve los items por `productId` al recibir el sale original).',
  })
  @IsOptional()
  @IsUUID()
  saleTicketItemId?: string;

  @ApiPropertyOptional({
    description:
      'ID del producto. Útil cuando el ticket original aún no se sincronizó y no hay sale_ticket_item_id real. El backend resuelve el item por (productId, ticket).',
  })
  @IsOptional()
  @IsUUID()
  productId?: string;

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

  @ApiPropertyOptional({
    description:
      'UUID del usuario cajero que procesó la devolución. Ver CreateSaleTicketDto.cashierUserId. Opcional para compatibilidad con payloads viejos.',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiPropertyOptional({
    description:
      'Ticket original (UUID). Provee este O `referenceClientUuid`. Para devoluciones offline contra tickets pending, usar `referenceClientUuid`.',
  })
  @IsOptional()
  @IsUUID()
  referenceTicketId?: string;

  @ApiPropertyOptional({
    description:
      '`client_uuid` del ticket original. Lo usa el sync engine del POS cuando sube una devolución contra un ticket cerrado offline: el backend resuelve el ticket por client_uuid (idempotency key) en lugar del id UUID que aún no existía cuando el POS encoló la devolución.',
  })
  @IsOptional()
  @IsUUID()
  referenceClientUuid?: string;

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
