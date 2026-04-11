import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateBrandDto {
  @ApiProperty({ example: 'Bayer', description: 'Nombre de la marca' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: true, description: 'Indica si es un laboratorio farmacéutico' })
  @IsOptional()
  @IsBoolean()
  isLaboratory?: boolean;
}
