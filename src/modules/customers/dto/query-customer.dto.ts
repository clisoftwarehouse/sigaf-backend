import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsEnum, IsString, IsBoolean, IsOptional } from 'class-validator';

import { CUSTOMER_TYPES } from './create-customer.dto';

export class QueryCustomerDto {
  @ApiPropertyOptional({ description: 'Búsqueda por nombre, número de documento o teléfono' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CUSTOMER_TYPES })
  @IsOptional()
  @IsEnum(CUSTOMER_TYPES)
  customerType?: (typeof CUSTOMER_TYPES)[number];

  @ApiPropertyOptional({ description: 'Si se omite devuelve sólo activos' })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}
