import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, Matches, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'Medicamentos', description: 'Nombre de la categoría' })
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'name no puede estar vacío ni contener solo espacios' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: 'MED', description: 'Código único de la categoría' })
  @IsOptional()
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const t = value.trim();
    return t.length === 0 ? undefined : t;
  })
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
