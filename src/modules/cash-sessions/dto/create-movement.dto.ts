import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';

const MANUAL_TYPES = ['payout', 'deposit', 'adjustment'] as const;

const METHODS = ['EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL', 'TDD', 'TDC', 'ZELLE', 'OTRO'] as const;

/**
 * Movimientos manuales que el cajero/supervisor puede crear durante el turno:
 * payout (extracción), deposit (entrada extra) o adjustment (corrección).
 * Las ventas y devoluciones generan sus propios movements automáticamente.
 */
export class CreateManualMovementDto {
  @ApiPropertyOptional({
    description:
      'UUID del cajero que registra el movimiento. Opcional para compatibilidad; si falta, se atribuye al openedByUserId de la sesión.',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiProperty({ enum: MANUAL_TYPES })
  @IsEnum(MANUAL_TYPES)
  type: (typeof MANUAL_TYPES)[number];

  @ApiProperty({ enum: METHODS })
  @IsEnum(METHODS)
  paymentMethod: (typeof METHODS)[number];

  @ApiProperty({
    description: 'Monto USD. Positivo = entrada (deposit/adjustment+); negativo = salida (payout/adjustment-).',
  })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  amountUsd: number;

  @ApiPropertyOptional({ description: 'Monto Bs si aplica' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  amountBs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6 })
  exchangeRateUsed?: number;

  @ApiProperty({ description: 'Justificación obligatoria del movimiento' })
  @IsString()
  notes: string;
}
