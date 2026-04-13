import { ApiProperty } from '@nestjs/swagger';
import { Min, IsEnum, IsUUID, IsNumber, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

export class CreateInventoryLotDto {
  @ApiProperty({ example: 'uuid', description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'uuid', description: 'ID de la sucursal' })
  @IsUUID()
  branchId: string;

  @ApiProperty({ example: 'LOT-2026-001', description: 'Número de lote' })
  @IsString()
  @MaxLength(50)
  lotNumber: string;

  @ApiProperty({ example: '2027-12-31', description: 'Fecha de vencimiento' })
  @IsDateString()
  expirationDate: string;

  @IsOptional()
  @IsDateString()
  manufactureDate?: string;

  @IsOptional()
  @IsEnum(['purchase', 'consignment'])
  acquisitionType?: string;

  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiProperty({ example: 5.5, description: 'Costo en USD' })
  @IsNumber()
  @Min(0)
  costUsd: number;

  @ApiProperty({ example: 8.99, description: 'Precio de venta' })
  @IsNumber()
  @Min(0)
  salePrice: number;

  @ApiProperty({ example: 100, description: 'Cantidad recibida' })
  @IsNumber()
  @Min(0)
  quantityReceived: number;

  @IsOptional()
  @IsUUID()
  consignmentEntryId?: string;

  @IsOptional()
  @IsUUID()
  locationId?: string;
}
