import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  Max,
  IsEnum,
  IsUUID,
  IsArray,
  IsNumber,
  IsString,
  IsBoolean,
  MaxLength,
  ValidateIf,
  IsOptional,
  IsDateString,
  ValidateNested,
} from 'class-validator';

export type PromotionTypeDto = 'percentage' | 'fixed_amount' | 'buy_x_get_y';
export type PromotionScopeTypeDto = 'product' | 'category' | 'branch';

export class PromotionScopeInputDto {
  @ApiProperty({ enum: ['product', 'category', 'branch'] })
  @IsEnum(['product', 'category', 'branch'])
  scopeType: PromotionScopeTypeDto;

  @ApiProperty({ description: 'ID del producto / categoría / sucursal según scopeType' })
  @IsUUID()
  scopeId: string;
}

export class CreatePromotionDto {
  @ApiProperty({ example: '10% de descuento en analgésicos' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    enum: ['percentage', 'fixed_amount', 'buy_x_get_y'],
    description:
      'percentage: value=% off. fixed_amount: value=USD off por unidad. buy_x_get_y: requiere buyQuantity y getQuantity.',
  })
  @IsEnum(['percentage', 'fixed_amount', 'buy_x_get_y'])
  type: PromotionTypeDto;

  @ApiProperty({ example: 10, description: 'Valor (% si percentage, USD si fixed_amount, ignorado si buy_x_get_y)' })
  @IsNumber()
  @Min(0)
  @ValidateIf((o) => o.type === 'percentage')
  @Max(100)
  value: number;

  @ApiPropertyOptional({ example: 2, description: 'Solo buy_x_get_y: cuántas se pagan' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  buyQuantity?: number;

  @ApiPropertyOptional({ example: 1, description: 'Solo buy_x_get_y: cuántas gratis' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  getQuantity?: number;

  @ApiPropertyOptional({ example: 1, description: 'Cantidad mínima para aplicar la promo' })
  @IsOptional()
  @IsNumber()
  @Min(0.001)
  minQuantity?: number;

  @ApiPropertyOptional({ description: 'Límite total de usos (null = ilimitado)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUses?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Prioridad: mayor gana cuando hay varias aplicables no stackable',
  })
  @IsOptional()
  @IsNumber()
  priority?: number;

  @ApiPropertyOptional({ description: 'Si true, puede combinarse con otras promos stackable' })
  @IsOptional()
  @IsBoolean()
  stackable?: boolean;

  @ApiProperty({ example: '2026-04-17T00:00:00Z' })
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional({
    example: '2026-04-30T23:59:59Z',
    description: 'Sin vigencia final → omitir o null',
  })
  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @ApiPropertyOptional({
    type: [PromotionScopeInputDto],
    description:
      'Restricciones de aplicabilidad. Si no se envía ninguna, la promo aplica a TODOS los productos y sucursales.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PromotionScopeInputDto)
  scopes?: PromotionScopeInputDto[];
}
