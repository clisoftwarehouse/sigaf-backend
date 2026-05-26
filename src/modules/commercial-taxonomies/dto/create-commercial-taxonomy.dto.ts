import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class CreateCommercialTaxonomyDto {
  @ApiProperty({ example: 'Total 12', description: 'Nombre de la línea o variante comercial' })
  @IsString()
  @MaxLength(120)
  name: string;
}
