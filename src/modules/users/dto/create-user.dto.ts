import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength, IsNotEmpty, IsOptional } from 'class-validator';

import { RoleDto } from '../../roles/dto/role.dto';
import { lowerCaseTransformer } from '@/common/utils/transformers/lower-case.transformer';

export class CreateUserDto {
  @ApiProperty({ example: 'admin', type: String })
  @IsNotEmpty()
  @IsString()
  username: string;

  @ApiProperty({ example: 'secret123', type: String })
  @MinLength(6)
  password?: string;

  @ApiProperty({ example: 'Juan Pérez', type: String })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiPropertyOptional({ example: 'V-12345678', type: String })
  @IsOptional()
  @IsString()
  cedula?: string | null;

  @ApiPropertyOptional({ example: 'admin@example.com', type: String })
  @Transform(lowerCaseTransformer)
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: '+58412123456', type: String })
  @IsOptional()
  @IsString()
  phone?: string | null;

  @ApiPropertyOptional({ type: RoleDto })
  @IsOptional()
  @Type(() => RoleDto)
  role?: RoleDto | null;
}
