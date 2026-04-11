import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsEmail, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateSupplierDto {
  @ApiProperty({ example: 'J-12345678-0', description: 'RIF del proveedor' })
  @IsString()
  @MaxLength(20)
  rif: string;

  @ApiProperty({ example: 'Distribuidora Farmacéutica ABC', description: 'Razón social' })
  @IsString()
  @MaxLength(200)
  businessName: string;

  @ApiPropertyOptional({ example: 'DFA', description: 'Nombre comercial' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  tradeName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  contactName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ example: true, description: 'Indica si es droguería con API B2B' })
  @IsOptional()
  @IsBoolean()
  isDrugstore?: boolean;

  @ApiPropertyOptional({ example: 30, description: 'Días de crédito' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentTermsDays?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  consignmentCommissionPct?: number;
}
