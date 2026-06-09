import { Type } from 'class-transformer';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Body, Post, Request, UseGuards, Controller } from '@nestjs/common';
import {
  Min,
  IsIn,
  IsUUID,
  IsArray,
  IsString,
  IsNumber,
  IsOptional,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { INVENTORY_WRITERS } from '@/modules/roles/roles.constants';
import { SuggestionsService, type SuggestionDecision } from '../services/suggestions.service';

class GenerateSuggestionsDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  abcd?: Array<'A' | 'B' | 'C' | 'D'>;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budgetUsd?: number;
}

class CreateOrderSuggestionItem {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @IsUUID()
  supplierId: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  netCostUsd: number;

  @IsIn([
    'buy_urgent',
    'buy',
    'buy_moderate',
    'no_buy',
    'review',
    'dynamize_candidate',
    'decode_candidate',
    'blocked_expiry',
  ])
  decision: SuggestionDecision;

  @IsString()
  reason: string;
}

class CreateOrdersFromSuggestionsBody {
  @IsUUID()
  branchId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderSuggestionItem)
  suggestions: CreateOrderSuggestionItem[];

  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Purchases Intelligence — Suggestions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'purchases-intelligence/suggestions', version: '1' })
export class SuggestionsController {
  constructor(private readonly service: SuggestionsService) {}

  @Post('generate')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary: 'Genera el sugerido de compra a partir de las clasificaciones vigentes. Devuelve in-memory (no persiste).',
  })
  generate(@Body() body: GenerateSuggestionsDto) {
    return this.service.generate(body.branchId, {
      abcd: body.abcd,
      budgetUsd: body.budgetUsd,
    });
  }

  @Post('create-orders')
  @Roles(...INVENTORY_WRITERS)
  @ApiOperation({
    summary:
      'Convierte sugerencias seleccionadas en OCs reales (estado=draft, agrupadas por droguería, snapshot del motor en cada item).',
  })
  createOrders(@Body() body: CreateOrdersFromSuggestionsBody, @Request() req: { user: { id: string } }) {
    return this.service.createOrdersFromSuggestions(body, req.user?.id || 'system');
  }
}
