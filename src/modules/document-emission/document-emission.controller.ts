import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Get, Body, Post, Query, UseGuards, Controller } from '@nestjs/common';

import { RoleEnum } from '@/modules/roles/roles.enum';
import { Roles } from '@/modules/roles/roles.decorator';
import { RolesGuard } from '@/modules/roles/roles.guard';
import { DocumentEmissionService } from './document-emission.service';
import { UpsertEmissionMethodDto } from './dto/upsert-emission-method.dto';
import { PluginDiscoveryService } from '../emission-plugins/plugin-discovery.service';
import { JwtOrTerminalApiKeyGuard } from '@/common/guards/jwt-or-terminal-api-key.guard';

/**
 * Endpoint del POS: lista los métodos de emisión ACTIVOS del terminal,
 * cruzando la config de BD con los plugins realmente descubiertos. Si un
 * método está configurado pero su handler ya no existe, se omite.
 */
@ApiTags('Emission Methods (POS)')
@ApiBearerAuth()
@Controller({ path: 'pos/emission-methods', version: '1' })
export class PosEmissionMethodsController {
  constructor(
    private readonly discovery: PluginDiscoveryService,
    private readonly emission: DocumentEmissionService,
  ) {}

  @Get()
  @UseGuards(JwtOrTerminalApiKeyGuard)
  @ApiOperation({ summary: 'Métodos de emisión activos para un terminal' })
  async list(@Query('terminal_id') terminalId: string) {
    const configs = await this.emission.findAllActive(terminalId);
    return configs
      .map((cfg) => {
        const plugin = this.discovery.get(cfg.methodKey);
        if (!plugin) return null;
        return {
          key: plugin.key,
          displayName: plugin.displayName,
          requiresLocalDriver: plugin.requiresLocalDriver,
          configId: cfg.id,
          config: cfg.configJson,
          priority: cfg.priority,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }
}

/**
 * Endpoints admin: ver todos los plugins descubiertos (activos o no) para un
 * terminal y activarlos/configurarlos. El form de config se genera dinámico
 * desde el `configSchema` de cada plugin.
 */
@ApiTags('Emission Methods (Admin)')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller({ path: 'admin/emission-methods', version: '1' })
export class AdminEmissionMethodsController {
  constructor(
    private readonly discovery: PluginDiscoveryService,
    private readonly emission: DocumentEmissionService,
  ) {}

  @Get('available')
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Plugins descubiertos + estado de configuración del terminal' })
  async available(@Query('terminal_id') terminalId: string) {
    const configs = terminalId ? await this.emission.findAllForTerminal(terminalId) : [];
    const byKey = new Map(configs.map((c) => [c.methodKey, c]));
    return this.discovery.getAll().map((plugin) => {
      const cfg = byKey.get(plugin.key);
      return {
        key: plugin.key,
        displayName: plugin.displayName,
        requiresLocalDriver: plugin.requiresLocalDriver,
        configSchema: plugin.configSchema,
        configured: !!cfg,
        isActive: cfg?.isActive ?? false,
        config: cfg?.configJson ?? {},
        priority: cfg?.priority ?? 100,
      };
    });
  }

  @Post()
  @Roles(RoleEnum.admin)
  @ApiOperation({ summary: 'Activar/configurar un método de emisión en un terminal' })
  upsert(@Body() dto: UpsertEmissionMethodDto) {
    return this.emission.upsertMethod(dto);
  }
}
