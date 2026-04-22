import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, Matches, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

import { CONCENTRATION_HINT, CONCENTRATION_REGEX, normalizeConcentration } from '@/common/utils/concentration';

export class AddIngredientDto {
  @ApiProperty({ description: 'ID del principio activo' })
  @IsUUID()
  activeIngredientId: string;

  @ApiPropertyOptional({ example: '500 mg', description: 'Concentración (número + unidad)' })
  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizeConcentration(value)))
  @IsString()
  @Matches(CONCENTRATION_REGEX, { message: CONCENTRATION_HINT })
  @MaxLength(50)
  concentration?: string;

  @ApiPropertyOptional({ example: true, description: 'Principio activo principal' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
