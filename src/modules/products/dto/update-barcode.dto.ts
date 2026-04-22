import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class UpdateBarcodeDto {
  @ApiPropertyOptional({ example: '7501234567890' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @ApiPropertyOptional({
    example: 'ean13',
    enum: ['ean13', 'ean8', 'upc', 'internal', 'national', 'international'],
  })
  @IsOptional()
  @IsEnum(['ean13', 'ean8', 'upc', 'internal', 'national', 'international'])
  barcodeType?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
