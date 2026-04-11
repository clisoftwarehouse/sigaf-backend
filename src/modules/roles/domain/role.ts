import { Allow } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class Role {
  @Allow()
  @ApiProperty({ type: String })
  id: string;

  @Allow()
  @ApiProperty({ type: String, example: 'administrador' })
  name?: string;

  @ApiProperty({ type: String, nullable: true })
  description?: string | null;
}
