import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  Min,
  IsEnum,
  IsUUID,
  IsArray,
  IsString,
  IsNumber,
  MinLength,
  IsOptional,
  ArrayNotEmpty,
  ValidateNested,
} from 'class-validator';

export const COUNT_TYPES = ['full', 'partial', 'cycle'] as const;
export const COUNT_STATUSES = ['draft', 'in_progress', 'completed', 'approved', 'cancelled'] as const;

export class CreateInventoryCountDto {
  @ApiProperty({ example: 'uuid', description: 'ID de la sucursal donde se realiza la toma' })
  @IsUUID()
  branchId: string;

  @ApiProperty({
    example: 'full',
    enum: COUNT_TYPES,
    description: 'Tipo de toma: full (todo el almacén), partial (filtrado), cycle (rotación por productos)',
  })
  @IsEnum(COUNT_TYPES)
  countType: (typeof COUNT_TYPES)[number];

  @ApiProperty({ required: false, description: 'Filtrar por categoría (partial)' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiProperty({ required: false, description: 'Filtrar por ubicación física (partial)' })
  @IsOptional()
  @IsUUID()
  locationId?: string;

  @ApiProperty({ required: false, type: [String], description: 'Productos a contar (partial/cycle)' })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  productIds?: string[];

  @ApiProperty({ required: false, description: 'Notas u observaciones' })
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CountItemUpdateDto {
  @ApiProperty({ example: 98.5, description: 'Cantidad física contada' })
  @IsNumber()
  @Min(0)
  countedQuantity: number;
}

export class BulkCountItemDto {
  @IsUUID()
  itemId: string;

  @IsNumber()
  @Min(0)
  countedQuantity: number;
}

export class BulkUpdateCountItemsDto {
  @ApiProperty({ type: [BulkCountItemDto], description: 'Lista de items a actualizar en lote' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkCountItemDto)
  items: BulkCountItemDto[];
}

export class ApproveCountDto {
  @ApiProperty({
    example: 'Diferencias verificadas físicamente por supervisor',
    description: 'Justificación para aprobar (mínimo 10 caracteres)',
  })
  @IsString()
  @MinLength(10)
  justification: string;
}

export class CancelCountDto {
  @ApiProperty({ example: 'Cancelado por inicio erróneo', description: 'Razón de cancelación' })
  @IsString()
  @MinLength(10)
  reason: string;
}

export class QueryInventoryCountDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @IsEnum(COUNT_TYPES)
  countType?: string;

  @IsOptional()
  @IsEnum(COUNT_STATUSES)
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 20;
}
