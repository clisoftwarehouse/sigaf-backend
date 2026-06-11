import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  Min,
  IsUUID,
  IsArray,
  IsString,
  IsNumber,
  MaxLength,
  IsOptional,
  IsDateString,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';

export class CreatePrescriptionItemDto {
  @ApiPropertyOptional({ description: 'Id generado por el cliente (POS offline). Si se omite, lo genera el backend.' })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 30, description: 'Cantidad prescrita por el médico' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantityPrescribed: number;

  @ApiPropertyOptional({ example: '1 tableta cada 8 horas por 7 días' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  posology?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreatePrescriptionDto {
  @ApiPropertyOptional({
    description: 'Id generado por el cliente (POS offline). Hace el POST idempotente al reintentar el sync.',
  })
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsUUID()
  customerId: string;

  @ApiProperty({ example: 'Dr. María Rodríguez' })
  @IsString()
  @MaxLength(150)
  doctorName: string;

  @ApiPropertyOptional({ example: 'MPPS-12345', description: 'Cédula o nº MPPS del médico' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  doctorIdNumber?: string;

  @ApiPropertyOptional({ description: 'Número del récipe físico/electrónico si aplica' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  prescriptionNumber?: string;

  @ApiProperty({ description: 'Fecha de emisión (ISO 8601)' })
  @IsDateString()
  issuedAt: string;

  @ApiPropertyOptional({ description: 'Vigencia. Si se omite usa default 30 días.' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'URL del archivo escaneado del récipe' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiProperty({ type: [CreatePrescriptionItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePrescriptionItemDto)
  items: CreatePrescriptionItemDto[];
}
