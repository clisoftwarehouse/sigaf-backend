import { IsString, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateActiveIngredientDto {
  @ApiProperty({ example: 'Losartán Potásico', description: 'Nombre del principio activo' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ example: 'Antihipertensivos', description: 'Grupo terapéutico' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  therapeuticGroup?: string;

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
