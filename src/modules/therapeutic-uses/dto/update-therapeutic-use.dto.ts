import { PartialType } from '@nestjs/mapped-types';

import { CreateTherapeuticUseDto } from './create-therapeutic-use.dto';

export class UpdateTherapeuticUseDto extends PartialType(CreateTherapeuticUseDto) {}
