import { Min, IsUUID, IsNumber, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

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
  @MaxLength(30)
  locationCode: string;

  @IsOptional()
  @IsBoolean()
  isQuarantine?: boolean;
}
