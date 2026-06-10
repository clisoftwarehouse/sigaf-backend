import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Req,
  Body,
  Post,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { CustomersService } from './customers.service';
import { ClinicalProfileService } from './clinical-profile.service';
import { QueryCustomerDto, CreateCustomerDto, UpdateCustomerDto } from './dto';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'customers', version: '1' })
export class CustomersController {
  constructor(
    private readonly customersService: CustomersService,
    private readonly clinicalProfileService: ClinicalProfileService,
  ) {}

  @Get(':id/clinical-profile')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({
    summary:
      'Perfil de atención al cliente: última compra, recurrencia, alertas clínicas y récipes pendientes. Usado por el POS.',
  })
  clinicalProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicalProfileService.getProfile(id);
  }

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar clientes (paginado)' })
  findAll(@Query() query: QueryCustomerDto) {
    return this.customersService.findAll(query);
  }

  @Get('by-document/:type/:number')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Buscar cliente por tipo + número de documento' })
  findByDocument(@Param('type') type: string, @Param('number') number: string) {
    return this.customersService.findByDocument(type, number);
  }

  @Get(':id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Obtener cliente por id' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Crear cliente' })
  create(@Body() dto: CreateCustomerDto, @Req() req: RequestWithUser) {
    return this.customersService.create(dto, req.user?.id ?? null);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar cliente' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Inactivar cliente (soft-delete)' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.remove(id);
  }

  @Patch(':id/restore')
  @ApiOperation({ summary: 'Reactivar cliente inactivo' })
  restore(@Param('id', ParseUUIDPipe) id: string) {
    return this.customersService.restore(id);
  }
}
