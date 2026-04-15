import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsUUID, IsEmail, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

import { BrandType, BRAND_TYPES } from '../infrastructure/persistence/relational/entities/brand.entity';

export class CreateBrandDto {
  @ApiProperty({ example: 'Bayer' })
  @IsString()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  isLaboratory?: boolean;

  @ApiPropertyOptional({ example: 'J-12345678-0', description: 'RIF fiscal de la marca' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  rif?: string;

  @ApiPropertyOptional({ example: 'Bayer Venezuela C.A.' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  businessName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @ApiPropertyOptional({ example: 'Alemania' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  countryOfOrigin?: string;

  @ApiPropertyOptional({ enum: BRAND_TYPES, example: 'pharma' })
  @IsOptional()
  @IsIn(BRAND_TYPES)
  brandType?: BrandType;

  @ApiPropertyOptional({ description: 'La marca importa producto al país' })
  @IsOptional()
  @IsBoolean()
  isImporter?: boolean;

  @ApiPropertyOptional({ description: 'La marca fabrica el producto' })
  @IsOptional()
  @IsBoolean()
  isManufacturer?: boolean;

  @ApiPropertyOptional({ example: 'contribuyente_especial' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  taxRegime?: string;

  @ApiPropertyOptional({ description: 'Proveedor (opcional, si la marca también opera como droguería)' })
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ description: 'Marca matriz si esta es una sub-marca' })
  @IsOptional()
  @IsUUID()
  parentBrandId?: string;

  @ApiPropertyOptional({ example: 'https://www.bayer.com' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Registro sanitario o código regulatorio base' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  regulatoryCode?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
