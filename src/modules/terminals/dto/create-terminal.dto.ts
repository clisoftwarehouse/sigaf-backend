import { IsUUID, IsObject, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateTerminalDto {
  @IsUUID()
  branchId: string;

  @IsString()
  @MaxLength(20)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsObject()
  fiscalPrinterConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  scaleConfig?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  cashDrawerConfig?: Record<string, unknown>;
}
