import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

/**
 * DTO simplificado de marca: solo se requiere la descripción (`name`).
 * Los datos fiscales/contacto se manejan en el módulo `suppliers`.
 */
export class CreateBrandDto {
  @ApiProperty({ example: 'Bayer', description: 'Descripción/nombre de la marca' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: false, description: 'Indica si la marca es un laboratorio farmacéutico' })
  @IsOptional()
  @IsBoolean()
  isLaboratory?: boolean;

  @ApiPropertyOptional({ default: true, description: 'Marca activa (soft-delete)' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
