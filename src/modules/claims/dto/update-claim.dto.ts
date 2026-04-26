import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEnum, IsNumber, IsString, MaxLength, IsOptional } from 'class-validator';

export class UpdateClaimDto {
  @ApiPropertyOptional({
    enum: ['open', 'in_progress', 'resolved', 'rejected'],
    description: 'Nuevo estado',
  })
  @IsOptional()
  @IsEnum(['open', 'in_progress', 'resolved', 'rejected'])
  status?: 'open' | 'in_progress' | 'resolved' | 'rejected';

  @ApiPropertyOptional({ description: 'Título del reclamo' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({ description: 'Descripción del reclamo' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: 'Notas de resolución' })
  @IsOptional()
  @IsString()
  resolutionNotes?: string;

  @ApiPropertyOptional({ description: 'Monto reclamado en USD' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  amountUsd?: number;
}
