import { Transform } from 'class-transformer';
import { IsUUID, Matches, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class CreateWarehouseDto {
  @IsUUID()
  branchId: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'locationCode no puede estar vacío ni contener solo espacios' })
  @MaxLength(30)
  locationCode: string;

  @IsOptional()
  @IsBoolean()
  isQuarantine?: boolean;

  @IsOptional()
  @IsBoolean()
  isForSale?: boolean;

  @IsOptional()
  @IsBoolean()
  isForPurchase?: boolean;
}
