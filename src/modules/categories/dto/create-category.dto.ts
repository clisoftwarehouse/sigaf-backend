import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Medicamentos', description: 'Nombre de la categoría' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'MED', description: 'Código único de la categoría' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  code?: string;

  @ApiPropertyOptional({ example: 'uuid', description: 'ID de la categoría padre (para subcategorías)' })
  @IsOptional()
  @IsUUID()
  parentId?: string;

  @ApiPropertyOptional({ example: true, description: 'Indica si es categoría farmacéutica' })
  @IsOptional()
  @IsBoolean()
  isPharmaceutical?: boolean;
}
