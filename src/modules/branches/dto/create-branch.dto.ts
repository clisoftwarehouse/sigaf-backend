import { IsEmail, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateBranchDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsString()
  @MaxLength(20)
  rif: string;

  @IsString()
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  phone?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(150)
  email?: string;
}
