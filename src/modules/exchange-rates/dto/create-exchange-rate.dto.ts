import { Min, IsIn, IsNumber, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

import { RateSource, RATE_SOURCES } from '../rate-sources';

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
  @IsIn(RATE_SOURCES)
  source?: RateSource;

  @IsDateString()
  effectiveDate: string;
}
