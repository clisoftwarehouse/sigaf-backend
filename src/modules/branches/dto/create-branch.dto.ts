import { Transform } from 'class-transformer';
import { IsUUID, IsEmail, Matches, IsString, MaxLength, IsOptional } from 'class-validator';

import {
  PHONE_HINT,
  PHONE_REGEX,
  normalizeRif,
  normalizePhone,
  BRANCH_RIF_HINT,
  BRANCH_RIF_REGEX,
} from '@/common/utils/venezuelan-id';

export class CreateBranchDto {
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Matches(/\S/, { message: 'name no puede estar vacío ni contener solo espacios' })
  @MaxLength(100)
  name: string;

  @IsString()
  @Transform(({ value }) => normalizeRif(value))
  @Matches(BRANCH_RIF_REGEX, { message: BRANCH_RIF_HINT })
  @MaxLength(20)
  rif: string;

  @IsString()
  @MaxLength(255)
  address: string;

  @IsOptional()
  @Transform(({ value }) => (value === null || value === '' ? null : normalizePhone(value)))
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_HINT })
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;

  @IsOptional()
  @IsUUID()
  branchGroupId?: string;
}
