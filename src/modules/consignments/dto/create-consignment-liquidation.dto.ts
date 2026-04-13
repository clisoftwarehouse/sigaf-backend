import { IsUUID, IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateConsignmentLiquidationDto {
  @ApiProperty({ description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ example: '2026-01-01', description: 'Inicio del periodo' })
  @IsString()
  periodStart: string;

  @ApiProperty({ example: '2026-01-31', description: 'Fin del periodo' })
  @IsString()
  periodEnd: string;

  @ApiPropertyOptional({ description: 'ID de la entrada de consignación específica (si se liquida una sola)' })
  @IsOptional()
  @IsUUID()
  consignmentEntryId?: string;
}
