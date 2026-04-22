import { Transform } from 'class-transformer';
import { Min, IsUUID, Matches, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateLocationDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  aisle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  shelf?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  section?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  capacity?: number;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'locationCode no puede estar vacío ni contener solo espacios' })
  @MaxLength(30)
  locationCode: string;

  @IsOptional()
  @IsBoolean()
  isQuarantine?: boolean;
}
