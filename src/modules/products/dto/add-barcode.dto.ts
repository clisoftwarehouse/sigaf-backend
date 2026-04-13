import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class AddBarcodeDto {
  @ApiProperty({ example: '7501234567890', description: 'Código de barras' })
  @IsString()
  @MaxLength(50)
  barcode: string;

  @ApiPropertyOptional({
    example: 'ean13',
    enum: ['ean13', 'ean8', 'upc', 'internal', 'national', 'international'],
    description: 'Tipo de código de barras',
  })
  @IsOptional()
  @IsEnum(['ean13', 'ean8', 'upc', 'internal', 'national', 'international'])
  barcodeType?: string;

  @ApiPropertyOptional({ example: true, description: 'Código principal del producto' })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
