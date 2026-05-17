import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Body para POST /v1/terminals/pair: el PC instalador envía el código que
 * recibió del admin. Se consume y se devuelve la apiKey (única vez).
 */
export class PairTerminalDto {
  @ApiProperty({ example: 'ABC-123-XYZ' })
  @IsString()
  @MinLength(6)
  @MaxLength(20)
  code: string;
}
