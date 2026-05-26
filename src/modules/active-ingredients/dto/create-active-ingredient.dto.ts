import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsArray, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateActiveIngredientDto {
  @ApiProperty({ example: 'Losartán Potásico', description: 'Nombre del principio activo' })
  @IsString()
  @MaxLength(200)
  name: string;

  /**
   * @deprecated Usa `therapeuticUseIds` para soportar M2M. Este campo se
   * mantiene para compat con clientes legacy — si viene poblado se trata
   * como un array de un solo elemento.
   */
  @ApiPropertyOptional({
    deprecated: true,
    description: 'DEPRECATED: usar therapeuticUseIds. ID único de acción terapéutica (legacy).',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  therapeuticUseId?: string;

  @ApiPropertyOptional({
    description: 'IDs de acciones terapéuticas asociadas (M2M). Un PA puede tener varias.',
    type: [String],
    format: 'uuid',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  therapeuticUseIds?: string[];

  @ApiPropertyOptional({ example: 'C09CA01', description: 'Código ATC (WHO) — estándar internacional' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  atcCode?: string;

  @ApiPropertyOptional({ example: 'Losartan', description: 'Denominación Común Internacional (INN/DCI)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  innName?: string;
}
