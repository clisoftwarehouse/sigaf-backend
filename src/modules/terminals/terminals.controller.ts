import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Put, Body, Post, Param, Query, Delete, UseGuards, Controller, ParseUUIDPipe } from '@nestjs/common';

import { TerminalsService } from './terminals.service';
import { CreateTerminalDto, UpdateTerminalDto } from './dto';

@ApiTags('Terminals')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'terminals', version: '1' })
export class TerminalsController {
  constructor(private readonly service: TerminalsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar terminales POS por sucursal' })
  findAll(@Query('branchId') branchId?: string) {
    return this.service.findAll({ branchId });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear terminal POS (con config impresora fiscal)' })
  create(@Body() dto: CreateTerminalDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTerminalDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
