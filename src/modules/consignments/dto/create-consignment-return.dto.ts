import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsArray, IsNumber, IsString, MaxLength, IsOptional, ValidateNested } from 'class-validator';

export class CreateConsignmentReturnItemDto {
  @ApiProperty({ description: 'ID del ítem de consignación original' })
  @IsUUID()
  consignmentItemId: string;

  @ApiProperty({ description: 'ID del lote' })
  @IsUUID()
  lotId: string;

  @ApiProperty({ example: 10, description: 'Cantidad a devolver' })
  @IsNumber()
  @Min(0.001)
  quantity: number;

  @ApiProperty({ example: 2.5, description: 'Costo unitario USD' })
  @IsNumber()
  @Min(0)
  costUsd: number;
}

export class CreateConsignmentReturnDto {
  @ApiProperty({ description: 'ID de la entrada de consignación' })
  @IsUUID()
  consignmentEntryId: string;

  @ApiProperty({ description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ description: 'ID del proveedor' })
  @IsUUID()
  supplierId: string;

  @ApiProperty({ example: 'expired', description: 'Motivo de devolución' })
  @IsString()
  @MaxLength(50)
  reason: string;

  @ApiPropertyOptional({ description: 'Notas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiProperty({ type: [CreateConsignmentReturnItemDto], description: 'Ítems a devolver' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateConsignmentReturnItemDto)
  items: CreateConsignmentReturnItemDto[];
}
