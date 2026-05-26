import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, MinLength, IsOptional } from 'class-validator';

export class VoidSaleTicketDto {
  @ApiPropertyOptional({
    description:
      'UUID del usuario cajero que ejecuta la anulación. Ver CreateSaleTicketDto.cashierUserId. Opcional para compatibilidad.',
  })
  @IsOptional()
  @IsUUID()
  cashierUserId?: string;

  @ApiProperty({ description: 'Motivo obligatorio de la anulación' })
  @IsString()
  @MinLength(5)
  reason: string;
}
