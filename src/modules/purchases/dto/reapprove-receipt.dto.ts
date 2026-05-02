import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Reaprobación de una recepción que excedió tolerancia (PDF Política OC §5).
 * Requiere justificación obligatoria — queda en `goods_receipts.reapproval_justification`
 * para auditoría. La autoridad para reaprobar la decide el motor de aprobación
 * (Fase B): mismo rol que aprobaría una OC del monto equivalente.
 */
export class ReapproveReceiptDto {
  @ApiProperty({
    example: 'Proveedor confirmó vía email el incremento de costo por escasez. Recepción aceptada.',
    description: 'Justificación obligatoria (mínimo 10 caracteres)',
  })
  @IsString()
  @MinLength(10)
  @MaxLength(500)
  justification: string;
}
