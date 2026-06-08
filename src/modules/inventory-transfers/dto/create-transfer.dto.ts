import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsUUID,
  IsEnum,
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ArrayMinSize,
  IsDateString,
  ValidateNested,
} from 'class-validator';

export class TransferItemInputDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ description: 'ID del lote DE ORIGEN (debe pertenecer a fromBranchId y tener stock)' })
  @IsUUID()
  lotId: string;

  @ApiProperty({ example: 10, description: 'Cantidad a enviar (unidades del lote de origen)' })
  @IsNumber()
  @Min(0.001)
  quantitySent: number;
}

export class CreateTransferDto {
  @ApiPropertyOptional({
    enum: ['inter_branch', 'intra_branch'],
    default: 'inter_branch',
    description:
      'inter_branch: traslado entre sucursales (flujo draft → in_transit → completed). intra_branch: traslado entre almacenes del mismo branch (instantáneo).',
  })
  @IsOptional()
  @IsEnum(['inter_branch', 'intra_branch'])
  transferType?: 'inter_branch' | 'intra_branch' = 'inter_branch';

  @ApiProperty({ description: 'Sucursal origen' })
  @IsUUID()
  fromBranchId: string;

  @ApiProperty({
    description: 'Sucursal destino. Para intra_branch debe coincidir con fromBranchId; para inter_branch debe diferir.',
  })
  @IsUUID()
  toBranchId: string;

  @ApiPropertyOptional({ description: 'Almacén origen (requerido para intra_branch)' })
  @IsOptional()
  @IsUUID()
  fromLocationId?: string;

  @ApiPropertyOptional({ description: 'Almacén destino (requerido para intra_branch)' })
  @IsOptional()
  @IsUUID()
  toLocationId?: string;

  @ApiPropertyOptional({ description: 'ID de la recepción origen (cuando se clona desde un goods_receipt)' })
  @IsOptional()
  @IsUUID()
  sourceReceiptId?: string;

  @ApiPropertyOptional({ description: 'Fecha programada del traslado (default: hoy)' })
  @IsOptional()
  @IsDateString()
  transferDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiProperty({
    type: [TransferItemInputDto],
    description: 'Items a trasladar — al menos 1. Cada item referencia un lote específico del origen.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => TransferItemInputDto)
  items: TransferItemInputDto[];
}
