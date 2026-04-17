import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsString, IsNumber, IsOptional } from 'class-validator';

/**
 * Ajuste sobre un precio existente (corrección de typo, nota aclaratoria).
 * No cambia el scope (productId / branchId) ni la vigencia: para cambiar
 * precio crear uno nuevo (así queda histórico del cambio).
 */
export class UpdatePriceDto {
  @ApiPropertyOptional({ example: 13.25, description: 'Nuevo precio USD (solo corrección — no cambia vigencia)' })
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  priceUsd?: number;

  @ApiPropertyOptional({ example: 'Corrección: typo en precio' })
  @IsOptional()
  @IsString()
  notes?: string;
}
