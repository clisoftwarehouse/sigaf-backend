import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImportErrorDto {
  @ApiProperty({ example: 3, description: 'Número de fila en el archivo (1-indexed, excluyendo headers)' })
  row: number;

  @ApiPropertyOptional({ example: 'ean', description: 'Campo con error (si aplica)' })
  field?: string;

  @ApiProperty({ example: "Código de barras '7591234567890' ya registrado" })
  message: string;
}

export class ImportResultDto {
  @ApiProperty({ example: 'products', description: 'Tipo de importación' })
  type: string;

  @ApiProperty({ example: true, description: 'Si es preview (no persiste)' })
  dryRun: boolean;

  @ApiProperty({ example: 100, description: 'Total de filas procesadas' })
  total: number;

  @ApiProperty({ example: 95, description: 'Filas procesadas exitosamente' })
  success: number;

  @ApiProperty({ example: 5, description: 'Filas con error' })
  failed: number;

  @ApiProperty({ example: 80, description: 'Registros creados' })
  created: number;

  @ApiProperty({ example: 15, description: 'Registros actualizados (upsert)' })
  updated: number;

  @ApiProperty({ type: [ImportErrorDto] })
  errors: ImportErrorDto[];
}
