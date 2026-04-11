import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsNumber, IsString, MinLength } from 'class-validator';

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
    enum: ['damage', 'correction', 'count_difference', 'expiry_write_off'],
    description: 'Tipo de ajuste',
  })
  @IsEnum(['damage', 'correction', 'count_difference', 'expiry_write_off'])
  adjustmentType: string;

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
