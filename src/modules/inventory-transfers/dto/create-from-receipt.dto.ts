import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsEnum, IsString, IsOptional } from 'class-validator';

/**
 * Clona los items de una recepción (goods_receipt) en una nueva transferencia,
 * mandando TODO lo recibido a un almacén destino.
 *
 * Caso típico: acabo de recepcionar mercancía en "Recepción" y la mando completa
 * a "Sala de ventas" (intra_branch, instantáneo). El backend identifica los lotes
 * creados durante la recepción y los pasa al almacén destino.
 */
export class CreateFromReceiptDto {
  @ApiProperty({
    enum: ['inter_branch', 'intra_branch'],
    description:
      'Tipo de traslado. intra_branch = mismo branch del receipt; inter_branch = otra sucursal (requiere toBranchId).',
  })
  @IsEnum(['inter_branch', 'intra_branch'])
  transferType: 'inter_branch' | 'intra_branch';

  @ApiProperty({ description: 'Almacén destino donde se ubicará la mercancía recibida' })
  @IsUUID()
  toLocationId: string;

  @ApiPropertyOptional({
    description:
      'Almacén origen (requerido para intra_branch). Los lotes de la recepción deben estar en este almacén (o sin almacén asignado).',
  })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({
    description:
      'Solo para inter_branch: sucursal destino. Si no se envía y es intra_branch, se usa branch del receipt.',
  })
  @IsOptional()
  @IsUUID()
  toBranchId?: string;

  @ApiPropertyOptional({ description: 'Observaciones del traslado' })
  @IsOptional()
  @IsString()
  notes?: string;
}
