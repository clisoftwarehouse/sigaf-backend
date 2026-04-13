import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class AddIngredientDto {
  @ApiProperty({ description: 'ID del principio activo' })
  @IsUUID()
  activeIngredientId: string;

  @ApiPropertyOptional({ example: '50mg', description: 'Concentración' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  concentration?: string;

  @ApiPropertyOptional({ example: true, description: 'Principio activo principal' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
