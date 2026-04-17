import type { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiBody, ApiQuery, ApiParam, ApiConsumes, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  Get,
  Res,
  Post,
  Param,
  Query,
  Request,
  UseGuards,
  Controller,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';

import { ImportResultDto } from './dto/import-result.dto';
import { TemplateBuilder } from './parsers/template-builder';
import { ImportType, ImportsService } from './imports.service';

const ALLOWED_TYPES: ImportType[] = ['products', 'stock-initial', 'prices'];

@ApiTags('Imports')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller({ path: 'imports', version: '1' })
export class ImportsController {
  constructor(private readonly importsService: ImportsService) {}

  @Post(':type')
  @ApiOperation({
    summary: 'Importar datos masivos desde CSV/XLSX',
    description:
      'Tipos soportados: `products`, `stock-initial`, `prices`. Con `?dryRun=true` valida el archivo sin persistir nada (útil para preview).',
  })
  @ApiParam({ name: 'type', enum: ALLOWED_TYPES })
  @ApiQuery({ name: 'dryRun', required: false, type: Boolean, description: 'Si true, valida sin persistir' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'Archivo .csv, .xlsx o .xls' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async import(
    @Param('type') type: string,
    @Query('dryRun') dryRun: string | undefined,
    @UploadedFile() file: { buffer: Buffer; originalname: string } | undefined,
    @Request() req: { user?: { id: string } },
  ): Promise<ImportResultDto> {
    if (!ALLOWED_TYPES.includes(type as ImportType)) {
      throw new BadRequestException(`Tipo inválido. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
    }
    const isDry = dryRun === 'true' || dryRun === '1';
    return this.importsService.import(type as ImportType, file, isDry, req.user?.id || 'system');
  }

  @Get('templates/:type')
  @ApiOperation({ summary: 'Descargar template XLSX con headers y ejemplos para un tipo de importación' })
  @ApiParam({ name: 'type', enum: ALLOWED_TYPES })
  downloadTemplate(@Param('type') type: string, @Res() res: Response): void {
    if (!ALLOWED_TYPES.includes(type as ImportType)) {
      throw new BadRequestException(`Template no disponible. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
    }
    const buffer = TemplateBuilder.build(type);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="template-${type}.xlsx"`);
    res.send(buffer);
  }
}
