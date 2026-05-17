import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsNumber, IsString, IsOptional } from 'class-validator';

export class CloseCashSessionDto {
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
}
