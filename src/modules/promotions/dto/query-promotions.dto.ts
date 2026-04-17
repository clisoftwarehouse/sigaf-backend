import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEnum, IsUUID, IsNumber, IsBoolean, IsOptional, IsDateString } from 'class-validator';

import type { PromotionTypeDto } from './create-promotion.dto';

export class QueryPromotionsDto {
  @ApiPropertyOptional({ enum: ['percentage', 'fixed_amount', 'buy_x_get_y'] })
  @IsOptional()
  @IsEnum(['percentage', 'fixed_amount', 'buy_x_get_y'])
  type?: PromotionTypeDto;

  @ApiPropertyOptional({ description: 'Solo activas (default true)' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Vigentes en esa fecha (ISO). Default: ahora. Ignorado si includeExpired=true.' })
  @IsOptional()
  @IsDateString()
  activeAt?: string;

  @ApiPropertyOptional({ description: 'Incluir expiradas/inactivas' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeExpired?: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number = 20;
}

export class QueryApplicablePromotionsDto {
  @ApiPropertyOptional({ description: 'Producto para el que se resuelven promos' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    description: 'Sucursal (opcional). Si se pasa, filtra promos con scope branch que no coincida.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    example: 10,
    description: 'Cantidad a comprar — necesaria para buy_x_get_y y para validar min_quantity',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.001)
  quantity?: number;

  @ApiPropertyOptional({
    example: 12.5,
    description: 'Precio unitario USD. Si se pasa, la respuesta calcula el descuento y precio final de cada promo.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceUsd?: number;

  @ApiPropertyOptional({ description: 'Momento de consulta (ISO). Default: ahora.' })
  @IsOptional()
  @IsDateString()
  at?: string;
}
