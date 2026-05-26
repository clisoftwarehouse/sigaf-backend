import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { BranchesService } from './branches.service';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { CreateBranchDto, UpdateBranchDto } from './dto';
import { ORG_WRITERS } from '@/modules/roles/roles.constants';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

@ApiTags('Branches')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'branches', version: '1' })
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary: 'Listar sucursales (por default todas; ?isActive=true para solo activas)',
  })
  findAll(@Query('isActive') isActive?: string) {
    return this.branchesService.findAll({
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
    });
  }

  @Get(':id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  @Post()
  @Roles(...ORG_WRITERS)
  @ApiOperation({ summary: 'Crear sucursal' })
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Put(':id')
  @Roles(...ORG_WRITERS)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Delete(':id')
  @Roles(...ORG_WRITERS)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.remove(id);
  }
}
