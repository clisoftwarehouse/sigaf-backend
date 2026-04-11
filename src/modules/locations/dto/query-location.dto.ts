import { Type } from 'class-transformer';
import { IsUUID, IsBoolean, IsOptional } from 'class-validator';

export class QueryLocationDto {
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isQuarantine?: boolean;
}
