import { ApiProperty } from '@nestjs/swagger';
import { IsUUID, Matches, IsString } from 'class-validator';

export class VerifyPinDto {
  @ApiProperty({ description: 'ID del usuario supervisor' })
  @IsUUID()
  userId: string;

  @ApiProperty({ description: 'PIN de 4-6 dígitos numéricos' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe ser numérico (4-6 dígitos)' })
  pin: string;
}

export class SetPinDto {
  @ApiProperty({ description: 'PIN nuevo de 4-6 dígitos numéricos' })
  @IsString()
  @Matches(/^\d{4,6}$/, { message: 'El PIN debe ser numérico (4-6 dígitos)' })
  pin: string;
}
