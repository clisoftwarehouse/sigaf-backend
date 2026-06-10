import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, Max, IsUUID, IsNumber, IsOptional } from 'class-validator';

export class LibroQueryDto {
  @ApiProperty({ example: 2026, description: 'Año del período fiscal' })
  @Type(() => Number)
  @IsNumber()
  @Min(2000)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 6, description: 'Mes del período fiscal (1-12)' })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(12)
  month: number;

  @ApiPropertyOptional({ description: 'Filtrar por sucursal (opcional)' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
