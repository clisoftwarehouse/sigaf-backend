import { PartialType } from '@nestjs/mapped-types';

import { CreateLabConditionDto } from './create-lab-condition.dto';

export class UpdateLabConditionDto extends PartialType(CreateLabConditionDto) {}
