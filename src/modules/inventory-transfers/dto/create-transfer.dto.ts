import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsUUID,
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
  @ApiProperty({ description: 'Sucursal origen' })
  @IsUUID()
  fromBranchId: string;

  @ApiProperty({ description: 'Sucursal destino (distinta del origen)' })
  @IsUUID()
  toBranchId: string;

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
