import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, IsArray } from 'class-validator';

/**
 * Asigna un conjunto de sucursales a este grupo. Las sucursales que no estén
 * en la lista quedan en su grupo anterior (no se desasignan automáticamente).
 * Para mover una sucursal entre grupos, agrégala al destino.
 */
export class AssignBranchesDto {
  @ApiProperty({
    type: [String],
    description: 'IDs de sucursales a asignar a este grupo',
  })
  @IsArray()
  @IsUUID('all', { each: true })
  branchIds: string[];
}
