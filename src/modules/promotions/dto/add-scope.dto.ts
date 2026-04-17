import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsUUID } from 'class-validator';

import type { PromotionScopeTypeDto } from './create-promotion.dto';

export class AddScopeDto {
  @ApiProperty({ enum: ['product', 'category', 'branch'] })
  @IsEnum(['product', 'category', 'branch'])
  scopeType: PromotionScopeTypeDto;

  @ApiProperty({ description: 'ID del producto / categoría / sucursal según scopeType' })
  @IsUUID()
  scopeId: string;
}
