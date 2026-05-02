import { PartialType } from '@nestjs/swagger';

import { CreateBranchGroupDto } from './create-branch-group.dto';

export class UpdateBranchGroupDto extends PartialType(CreateBranchGroupDto) {}
