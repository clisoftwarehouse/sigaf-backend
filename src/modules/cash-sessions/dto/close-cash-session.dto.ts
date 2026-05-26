import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsNumber, IsString, IsOptional, IsDateString } from 'class-validator';

export class CloseCashSessionDto {
  @ApiPropertyOptional({
    description:
      'UUID del cajero que cierra la sesión. Opcional para compatibilidad con payloads antiguos; si falta, se atribuye al openedByUserId de la sesión (mismo operador que la abrió).',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiProperty({ example: 235.5, description: 'Total en efectivo USD declarado al cierre' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  closingDeclaredUsd: number;

  @ApiPropertyOptional({ example: 12500, description: 'Total en efectivo Bs declarado al cierre' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  closingDeclaredBs?: number;

  @ApiPropertyOptional({
    description: 'Notas del cierre (justificación de diferencias, observaciones, etc.)',
  })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'ISO 8601, hora REAL del cierre local en el POS. Sin esto el backend marcaría `closedAt = NOW()` (cuando se subió el sync), no cuando el cajero efectivamente cerró — daría la impresión de que la caja se cerró tarde.',
  })
  @IsOptional()
  @IsDateString()
  clientClosedAt?: string;
}
