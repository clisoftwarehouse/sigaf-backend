import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Min, IsIn, IsUUID, IsNumber, IsString, MaxLength, IsOptional, IsDateString } from 'class-validator';

const CURRENCIES = ['USD', 'VES'] as const;
const STATUSES = ['open', 'partial', 'paid', 'cancelled'] as const;
const METHODS = ['cash', 'transfer', 'check', 'dollars', 'mixed', 'other'] as const;

export class QueryAccountsPayableDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  supplierId?: string;

  @ApiPropertyOptional({ enum: STATUSES })
  @IsOptional()
  @IsIn(STATUSES as unknown as string[])
  status?: (typeof STATUSES)[number];

  @ApiPropertyOptional({ description: 'Filtrar por bucket de aging' })
  @IsOptional()
  @IsIn(['current', 'overdue_1_30', 'overdue_31_60', 'overdue_61_90', 'overdue_90_plus'])
  agingBucket?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;
}

export class CreateAccountsPayableDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty()
  @IsUUID()
  branchId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sourceReceiptId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  invoiceNumber?: string;

  @ApiProperty()
  @IsDateString()
  invoiceDate: string;

  @ApiProperty()
  @IsDateString()
  dueDate: string;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES as unknown as string[])
  currencyNative: (typeof CURRENCIES)[number];

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  originalAmountUsd: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  originalAmountNative: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRateAtCreation?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paymentTermsDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RegisterPaymentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amountUsd: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  amountNative: number;

  @ApiProperty({ enum: CURRENCIES })
  @IsIn(CURRENCIES as unknown as string[])
  currencyNative: (typeof CURRENCIES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  exchangeRate?: number;

  @ApiProperty({ enum: METHODS })
  @IsIn(METHODS as unknown as string[])
  method: (typeof METHODS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  reference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class ReversePaymentDto {
  @ApiProperty()
  @IsString()
  reason: string;
}

export class CancelCxpDto {
  @ApiProperty()
  @IsString()
  reason: string;
}
