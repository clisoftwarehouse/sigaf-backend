import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsString, IsNumber, IsOptional, IsDateString } from 'class-validator';

/**
 * Crea un nuevo precio. Si ya hay uno vigente para el mismo scope
 * (product + branch|null), el service lo cierra automáticamente
 * (`effective_to = new.effective_from`) antes de insertar el nuevo.
 */
export class CreatePriceDto {
  @ApiProperty({ example: 'uuid', description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    example: 'uuid',
    description: 'ID de sucursal. Omitir para precio global. Si se setea, sobrescribe el global para esa sucursal.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ example: 12.5, description: 'Precio en USD (siempre en dólares, nunca en Bs)' })
  @IsNumber()
  @Min(0.0001)
  priceUsd: number;

  @ApiPropertyOptional({
    example: '2026-04-17T00:00:00Z',
    description: 'Fecha de inicio de vigencia (ISO). Default = ahora.',
  })
  @IsOptional()
  @IsDateString()
  effectiveFrom?: string;

  @ApiPropertyOptional({ example: 'Ajuste por nueva lista de precios Q2' })
  @IsOptional()
  @IsString()
  notes?: string;
}
