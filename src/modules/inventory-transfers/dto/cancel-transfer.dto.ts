import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CancelTransferDto {
  @ApiPropertyOptional({ description: 'Razón de la cancelación (para auditoría)' })
  @IsOptional()
  @IsString()
  reason?: string;
}
