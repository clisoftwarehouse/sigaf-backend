import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class VoidSaleTicketDto {
  @ApiProperty({ description: 'Motivo obligatorio de la anulación' })
  @IsString()
  @MinLength(5)
  reason: string;
}
