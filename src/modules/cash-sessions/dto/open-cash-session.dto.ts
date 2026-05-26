import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class OpenCashSessionDto {
  @ApiProperty()
  @IsUUID()
  terminalId: string;

  @ApiPropertyOptional({
    description:
      'UUID del cajero que abre la sesión. Lo manda el POS porque la apiKey del terminal es el control de acceso (JWT puede no existir en modo offline). Opcional para compatibilidad con payloads antiguos encolados antes del schema change; en ese caso el service falla con mensaje claro.',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiProperty({ example: 50, description: 'Monto inicial en efectivo USD' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  openingAmountUsd: number;

  @ApiPropertyOptional({ example: 1000, description: 'Monto inicial en efectivo Bs' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  openingAmountBs?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601, hora REAL en que el cajero abrió la sesión en el POS. Sirve para preservar el timestamp correcto cuando la apertura se hizo offline y sube horas después: sin esto, el backend estampa `openedAt = NOW()` (hora del sync) y el reporte muestra el turno empezando tarde.',
  })
  @IsOptional()
  @IsDateString()
  clientOpenedAt?: string;
}
