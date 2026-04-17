import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsNumber, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

/**
 * Body para sobreescribir manualmente la tasa de cambio (p. ej. cuando el BCV
 * no ha publicado la tasa del día o hay un evento cambiario extraordinario).
 * El registro queda marcado con `is_overridden=true` y `source='manual'`.
 */
export class OverrideRateDto {
  @ApiProperty({ example: 36.5, description: 'Tasa USD → VES a aplicar' })
  @IsNumber()
  @Min(0)
  rate: number;

  @ApiPropertyOptional({ example: '2026-04-16', description: 'Fecha efectiva (ISO). Por defecto: hoy' })
  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @ApiPropertyOptional({ example: 'USD' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyFrom?: string;

  @ApiPropertyOptional({ example: 'VES' })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyTo?: string;

  @ApiPropertyOptional({ example: 'Tasa tomada del paralelo por falta de publicación BCV' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
