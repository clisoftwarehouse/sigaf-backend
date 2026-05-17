import { Transform } from 'class-transformer';
import { IsUUID, IsObject, IsString, MaxLength, MinLength, IsOptional } from 'class-validator';

export class CreateTerminalDto {
  @IsUUID()
  branchId: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Código obligatorio' })
  @MaxLength(20)
  code: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
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
