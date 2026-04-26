import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsEnum,
  IsUUID,
  IsNumber,
  IsString,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateClaimDto {
  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiPropertyOptional({ description: 'ID de la recepción asociada' })
  @IsOptional()
  @IsUUID()
  receiptId?: string;

  @ApiPropertyOptional({ description: 'ID de la sucursal' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    enum: ['quality', 'quantity', 'price_mismatch', 'other'],
    description: 'Tipo de reclamo',
  })
  @IsEnum(['quality', 'quantity', 'price_mismatch', 'other'])
  claimType: 'quality' | 'quantity' | 'price_mismatch' | 'other';

  @ApiProperty({ example: 'Lote vencido al recibir', description: 'Título del reclamo' })
  @IsString()
  @MaxLength(120)
  title: string;

  @ApiProperty({ description: 'Descripción detallada del reclamo' })
  @IsString()
  description: string;

  @ApiPropertyOptional({ example: 150.5, description: 'Monto reclamado en USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountUsd?: number;
}
