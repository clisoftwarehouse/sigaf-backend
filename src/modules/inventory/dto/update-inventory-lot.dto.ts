import { Min, IsEnum, IsUUID, IsNumber, IsOptional } from 'class-validator';

export class UpdateInventoryLotDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @IsOptional()
  @IsUUID()
  locationId?: string;

  @IsOptional()
  @IsEnum(['available', 'quarantine', 'expired', 'returned', 'depleted'])
  status?: string;
}

export class QuarantineLotDto {
  @IsOptional()
  quarantine: boolean;

  @IsOptional()
  reason: string;
}
