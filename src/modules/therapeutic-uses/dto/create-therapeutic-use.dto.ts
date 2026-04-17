import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTherapeuticUseDto {
  @ApiProperty({ example: 'Analgésico', description: 'Nombre del uso terapéutico' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Alivio del dolor', description: 'Descripción del uso' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ example: 'N02', description: 'Código ATC (WHO) nivel 1-3 — estándar internacional' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  atcCode?: string;
}
