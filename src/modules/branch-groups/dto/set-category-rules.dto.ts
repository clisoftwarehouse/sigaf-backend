import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID, IsArray, ValidateNested } from 'class-validator';

import {
  CategoryFlag,
  CATEGORY_FLAGS,
} from '../infrastructure/persistence/relational/entities/branch-group-category-approval-rule.entity';

export class CategoryRuleInputDto {
  @ApiProperty({ enum: CATEGORY_FLAGS })
  @IsEnum(CATEGORY_FLAGS)
  categoryFlag: CategoryFlag;

  @ApiProperty({ description: 'ID del rol aprobador para esta categoría' })
  @IsUUID()
  roleId: string;
}

/**
 * Reemplaza completamente la matriz de aprobación por categoría del grupo.
 * Solo se aceptan categorías del enum predefinido. Cada categoría puede tener
 * a lo más un aprobador (constraint único en BD).
 */
export class SetCategoryRulesDto {
  @ApiProperty({ type: [CategoryRuleInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryRuleInputDto)
  rules: CategoryRuleInputDto[];
}
