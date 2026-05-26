import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsEnum,
  IsUUID,
  IsArray,
  IsString,
  IsNumber,
  MaxLength,
  IsOptional,
  ValidateNested,
} from 'class-validator';

export class UpdatePurchaseOrderItemDto {
  @ApiProperty({ description: 'ID del producto' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 10, description: 'Cantidad' })
  @IsNumber()
  @Min(0.001)
  quantity: number;
}

export class UpdatePurchaseOrderDto {
  @ApiPropertyOptional({
    enum: ['draft', 'sent', 'cancelled'],
    description: 'Nuevo estado de la orden',
  })
  @IsOptional()
  @IsEnum(['draft', 'sent', 'cancelled'])
  status?: string;

  @ApiPropertyOptional({ description: 'Fecha esperada de entrega' })
  @IsOptional()
  @IsString()
  expectedDate?: string;

  @ApiPropertyOptional({ description: 'Notas' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  /**
   * Reemplazo TOTAL de los items de la OC. Solo permitido cuando la OC está
   * en estado 'draft' (no se han creado recepciones contra ella). El service
   * borra los items existentes e inserta los nuevos en una transacción.
   */
  @ApiPropertyOptional({
    type: [UpdatePurchaseOrderItemDto],
    description: 'Reemplazar items de la OC (solo en estado borrador)',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdatePurchaseOrderItemDto)
  items?: UpdatePurchaseOrderItemDto[];
}
