import { ApiProperty } from '@nestjs/swagger';
import { Expose, Exclude } from 'class-transformer';

import { Role } from '../../roles/domain/role';

export class User {
  @ApiProperty({ type: String })
  id: string;

  @ApiProperty({ type: String, example: 'admin' })
  username: string;

  @Exclude({ toPlainOnly: true })
  password?: string;

  @ApiProperty({ type: String, example: 'Juan Pérez' })
  fullName: string;

  @ApiProperty({ type: String, example: 'V-12345678' })
  @Expose({ groups: ['me', 'admin'] })
  cedula: string | null;

  @ApiProperty({ type: String, example: 'admin@example.com' })
  @Expose({ groups: ['me', 'admin'] })
  email: string | null;

  @ApiProperty({ type: String, example: '+58412123456' })
  phone: string | null;

  @ApiProperty({ type: () => Role })
  role?: Role | null;

  @ApiProperty({ type: Boolean })
  isActive: boolean;

  @ApiProperty()
  lastLoginAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
