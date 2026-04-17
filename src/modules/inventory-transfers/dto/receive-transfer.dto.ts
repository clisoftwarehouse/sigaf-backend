import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsUUID, IsArray, IsString, IsNumber, IsOptional, ArrayMinSize, ValidateNested } from 'class-validator';

export class ReceiveItemDto {
  @ApiProperty({ description: 'ID del item (inventory_transfer_items.id) a recepcionar' })
  @IsUUID()
  itemId: string;

  @ApiProperty({
    example: 10,
    description: 'Cantidad realmente recibida (puede ser menor por mermas en tránsito)',
  })
  @IsNumber()
  @Min(0)
  quantityReceived: number;
}

export class ReceiveTransferDto {
  @ApiProperty({
    type: [ReceiveItemDto],
    description:
      'Cantidades recibidas por item. La diferencia con quantitySent se asienta como ajuste (merma) en origen.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveItemDto)
  items: ReceiveItemDto[];

  @ApiPropertyOptional({ description: 'Observaciones de la recepción' })
  @IsOptional()
  @IsString()
  notes?: string;
}
