import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, IsNotEmpty } from 'class-validator';

import { lowerCaseTransformer } from '@/common/utils/transformers/lower-case.transformer';

export class AuthEmailLoginDto {
  @ApiProperty({ example: 'admin@example.com', description: 'Email o username', type: String })
  @Transform(lowerCaseTransformer)
  @IsString()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'secret' })
  @IsNotEmpty()
  password: string;
}
