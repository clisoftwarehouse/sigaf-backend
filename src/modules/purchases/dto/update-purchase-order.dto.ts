import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, MaxLength, IsOptional } from 'class-validator';

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
}
