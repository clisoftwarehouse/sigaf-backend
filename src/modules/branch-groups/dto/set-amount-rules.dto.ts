import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Min, IsUUID, IsArray, IsNumber, IsOptional, ValidateNested } from 'class-validator';

export class AmountRuleInputDto {
  @ApiProperty({ description: 'ID del rol que puede aprobar este rango' })
  @IsUUID()
  roleId: string;

  @ApiProperty({ example: 0, description: 'Mínimo USD inclusive' })
  @IsNumber()
  @Min(0)
  minUsd: number;

  @ApiProperty({
    example: 5000,
    nullable: true,
    description: 'Máximo USD inclusive. null = sin tope superior.',
  })
  @IsOptional()
  @IsNumber()
  maxUsd: number | null;
}

/**
 * Reemplaza completamente la matriz de aprobación por monto del grupo.
 * Operación atómica: todas las reglas previas se borran y se insertan las
 * nuevas (más simple que un diff parcial).
 */
export class SetAmountRulesDto {
  @ApiProperty({ type: [AmountRuleInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AmountRuleInputDto)
  rules: AmountRuleInputDto[];
}
