import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsInt, IsUUID, IsObject, IsString, IsBoolean, MaxLength, IsOptional } from 'class-validator';

export class UpsertEmissionMethodDto {
  @ApiProperty()
  @IsUUID()
  terminalId: string;

  @ApiProperty({ example: 'hka_fiscal' })
  @IsString()
  @MaxLength(50)
  methodKey: string;

  @ApiPropertyOptional({ description: 'Config específica del plugin (validada contra su configSchema)' })
  @IsOptional()
  @IsObject()
  configJson?: Record<string, unknown>;

  @ApiPropertyOptional({ default: 100 })
  @IsOptional()
  @IsInt()
  @Min(0)
  priority?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
