import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Put,
  Req,
  Body,
  Post,
  Param,
  Query,
  HttpCode,
  UseGuards,
  Controller,
  ParseUUIDPipe,
} from '@nestjs/common';

import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { PrescriptionsService } from './prescriptions.service';
import { PRESCRIPTION_WRITERS } from '@/modules/roles/roles.constants';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';
import { QueryPrescriptionDto, CreatePrescriptionDto, UpdatePrescriptionDto } from './dto';

interface RequestWithUser {
  user?: { id?: string };
}

@ApiTags('Prescriptions')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'prescriptions', version: '1' })
export class PrescriptionsController {
  constructor(private readonly prescriptionsService: PrescriptionsService) {}

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Listar récipes (paginado)' })
  findAll(@Query() query: QueryPrescriptionDto) {
    return this.prescriptionsService.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Obtener récipe por id (con items)' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...PRESCRIPTION_WRITERS)
  @ApiOperation({ summary: 'Registrar récipe médico (con items). Admin/gerente/farmacéutico.' })
  create(@Body() dto: CreatePrescriptionDto, @Req() req: RequestWithUser) {
    return this.prescriptionsService.create(dto, req.user?.id ?? null);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...PRESCRIPTION_WRITERS)
  @ApiOperation({ summary: 'Actualizar metadatos del récipe (no items)' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePrescriptionDto) {
    return this.prescriptionsService.update(id, dto);
  }

  @Post(':id/cancel')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(...PRESCRIPTION_WRITERS)
  @HttpCode(200)
  @ApiOperation({ summary: 'Anular récipe (no se puede deshacer)' })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.prescriptionsService.cancel(id);
  }
}
