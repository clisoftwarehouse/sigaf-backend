import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsString, IsNumber, MinLength, IsOptional, ValidateIf } from 'class-validator';

/**
 * Ajuste sobre un precio existente (corrección de typo, nota aclaratoria).
 * No cambia el scope (productId / branchId) ni la vigencia: para cambiar
 * precio crear uno nuevo (así queda histórico del cambio).
 *
 * Si `priceUsd` se modifica se exige `justification` — queda registrada en
 * `audit_log` para trazabilidad de correcciones.
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

  @ApiPropertyOptional({
    example: 'Error de tipeo: se cargó 12.50 cuando debía ser 13.25 según lista del proveedor',
    description: 'Justificación del cambio. Obligatoria cuando se modifica priceUsd. Se persiste en audit_log.',
  })
  @ValidateIf((o) => o.priceUsd !== undefined)
  @IsString()
  @MinLength(10, { message: 'La justificación debe tener al menos 10 caracteres' })
  justification?: string;
}
