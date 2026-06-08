import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsNumber, IsString, MinLength } from 'class-validator';

/**
 * Tipos de ajuste por dirección.
 *
 * Algunos tipos solo tienen sentido en una dirección:
 *  - Solo SALIDA (cantidad negativa): damage, expiry_write_off, theft,
 *    internal_use, loss.
 *  - Solo ENTRADA (cantidad positiva): return, donation, found.
 *  - Ambas direcciones: correction, count_difference (un conteo puede dar
 *    de más o de menos respecto al sistema).
 *
 * El backend valida que el `adjustmentType` enviado sea compatible con el
 * signo de `quantity` y rechaza si no calza.
 */
export const ADJUSTMENT_TYPES = [
  'damage',
  'correction',
  'count_difference',
  'expiry_write_off',
  'return',
  'donation',
  'found',
  'theft',
  'internal_use',
  'loss',
] as const;

export type AdjustmentType = (typeof ADJUSTMENT_TYPES)[number];

/** Tipos válidos solo cuando quantity > 0 (entrada). */
export const ADJUSTMENT_TYPES_IN_ONLY: AdjustmentType[] = ['return', 'donation', 'found'];

/** Tipos válidos solo cuando quantity < 0 (salida). */
export const ADJUSTMENT_TYPES_OUT_ONLY: AdjustmentType[] = [
  'damage',
  'expiry_write_off',
  'theft',
  'internal_use',
  'loss',
];

export class CreateAdjustmentDto {
  @ApiProperty({ example: 'uuid', description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'uuid', description: 'ID del lote' })
  @IsUUID()
  lotId: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    example: 'damage',
    enum: ADJUSTMENT_TYPES,
    description:
      'Tipo de ajuste. El backend valida que el tipo sea compatible con el signo de quantity ' +
      '(p.ej. "damage" solo aplica a salidas, "return" solo a entradas).',
  })
  @IsEnum(ADJUSTMENT_TYPES)
  adjustmentType: AdjustmentType;

  @ApiProperty({ example: -5, description: 'Cantidad (positivo=entrada, negativo=salida)' })
  @IsNumber()
  quantity: number;

  @ApiProperty({
    example: '5 unidades dañadas durante transporte',
    description: 'Razón del ajuste (mínimo 10 caracteres)',
  })
  @IsString()
  @MinLength(10)
  reason: string;
}
