import { Min, IsNumber, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

export class CreateExchangeRateDto {
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyFrom?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyTo?: string;

  @IsNumber()
  @Min(0)
  rate: number;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string;

  @IsDateString()
  effectiveDate: string;
}
