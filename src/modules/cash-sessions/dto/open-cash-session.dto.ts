import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsNumber, IsString, IsOptional } from 'class-validator';

export class OpenCashSessionDto {
  @ApiProperty()
  @IsUUID()
  terminalId: string;

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
}
