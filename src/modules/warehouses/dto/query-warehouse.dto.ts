import { Type } from 'class-transformer';
import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class QueryWarehouseDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isQuarantine?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isForSale?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isForPurchase?: boolean;
}
