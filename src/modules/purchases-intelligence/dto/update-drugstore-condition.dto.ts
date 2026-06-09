import { PartialType } from '@nestjs/mapped-types';

import { CreateDrugstoreConditionDto } from './create-drugstore-condition.dto';

export class UpdateDrugstoreConditionDto extends PartialType(CreateDrugstoreConditionDto) {}
