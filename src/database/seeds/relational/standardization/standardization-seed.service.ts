import * as path from 'path';
import * as XLSX from 'xlsx';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Injectable } from '@nestjs/common';

import { TherapeuticUseEntity } from '@/modules/therapeutic-uses/infrastructure/persistence/relational/entities/therapeutic-use.entity';
import { ActiveIngredientEntity } from '@/modules/active-ingredients/infrastructure/persistence/relational/entities/active-ingredient.entity';

/**
 * Seed idempotente del archivo "Estandarización de Datos.xlsx" entregado
 * por el cliente. Pobla:
 *   - therapeutic_uses: 69 acciones terapéuticas
 *   - active_ingredients: 2.885 principios activos + M2M con acciones
 *
 * Idempotente: re-ejecutable sin duplicar. Match por `name` case-insensitive.
 * Si un registro ya existe, actualiza la relación M2M (no toca otros campos
 * como ATC/INN que pueden venir del scraper de Vademecum).
 *
 * Las "Formas Farmacéuticas" y "Presentaciones" del Excel se manejan como
 * constants en el frontend (no se persisten en BD).
 */
@Injectable()
export class StandardizationSeedService {
  private readonly logger = new Logger(StandardizationSeedService.name);

  constructor(
    @InjectRepository(ActiveIngredientEntity)
    private readonly aiRepo: Repository<ActiveIngredientEntity>,
    @InjectRepository(TherapeuticUseEntity)
    private readonly tuRepo: Repository<TherapeuticUseEntity>,
  ) {}

  async run() {
    const xlsxPath = path.resolve(__dirname, '../../assets/Estandarización de Datos.xlsx');
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.readFile(xlsxPath);
    } catch (err) {
      this.logger.warn(
        `Standardization seed skipped — archivo no encontrado en ${xlsxPath}. Detalles: ${(err as Error).message}`,
      );
      return;
    }

    const stats = {
      therapeuticUsesCreated: 0,
      therapeuticUsesExisting: 0,
      ingredientsCreated: 0,
      ingredientsUpdated: 0,
      ingredientsSkipped: 0,
      missingTherapeuticUses: new Set<string>(),
    };

    // ─── 1. Acciones terapéuticas ──────────────────────────────────────
    const tuSheet = workbook.Sheets['Acción Terapeutica'];
    if (!tuSheet) {
      this.logger.warn('Sheet "Acción Terapeutica" no encontrada, skip.');
    } else {
      const rows = XLSX.utils.sheet_to_json<{ 'Acción Terapéutica': string }>(tuSheet, {
        defval: '',
      });
      for (const row of rows) {
        const name = String(row['Acción Terapéutica'] ?? '').trim();
        if (!name) continue;
        const existing = await this.tuRepo
          .createQueryBuilder('tu')
          .where('LOWER(tu.name) = LOWER(:name)', { name })
          .getOne();
        if (existing) {
          stats.therapeuticUsesExisting++;
        } else {
          await this.tuRepo.save(this.tuRepo.create({ name }));
          stats.therapeuticUsesCreated++;
        }
      }
    }

    // Cargar mapa name→entity (case-insensitive) para resolver referencias.
    const allTus = await this.tuRepo.find();
    const tuByLowerName = new Map(allTus.map((tu) => [tu.name.trim().toLowerCase(), tu] as const));

    // ─── 2. Principios activos ─────────────────────────────────────────
    const aiSheet = workbook.Sheets['Principio Activo'];
    if (!aiSheet) {
      this.logger.warn('Sheet "Principio Activo" no encontrada, skip.');
    } else {
      const rows = XLSX.utils.sheet_to_json<Record<string, string>>(aiSheet, { defval: '' });
      const ACTIONS_KEY = 'Acción Terapéutica (Multi Selección, Separado por Coma)';

      for (const row of rows) {
        const name = String(row['Principio Activo'] ?? '').trim();
        if (!name) continue;

        const actionsRaw = String(row[ACTIONS_KEY] ?? '').trim();
        const actionNames = actionsRaw
          ? actionsRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

        const therapeuticUses: TherapeuticUseEntity[] = [];
        for (const an of actionNames) {
          const tu = tuByLowerName.get(an.toLowerCase());
          if (tu) {
            therapeuticUses.push(tu);
          } else {
            stats.missingTherapeuticUses.add(an);
          }
        }

        const existing = await this.aiRepo
          .createQueryBuilder('ai')
          .where('LOWER(ai.name) = LOWER(:name)', { name })
          .leftJoinAndSelect('ai.therapeuticUses', 'tus')
          .getOne();

        if (existing) {
          // Solo actualizamos la relación M2M y el legacy id (primer item).
          existing.therapeuticUses = therapeuticUses;
          existing.therapeuticUseId = therapeuticUses[0]?.id ?? existing.therapeuticUseId ?? null;
          await this.aiRepo.save(existing);
          stats.ingredientsUpdated++;
        } else {
          const fresh = this.aiRepo.create({
            name,
            therapeuticUseId: therapeuticUses[0]?.id ?? null,
            therapeuticUses,
          });
          await this.aiRepo.save(fresh);
          stats.ingredientsCreated++;
        }
      }
    }

    this.logger.log(
      `Acciones terapéuticas: ${stats.therapeuticUsesCreated} nuevas, ${stats.therapeuticUsesExisting} existentes.`,
    );
    this.logger.log(
      `Principios activos: ${stats.ingredientsCreated} nuevos, ${stats.ingredientsUpdated} actualizados, ${stats.ingredientsSkipped} omitidos.`,
    );
    if (stats.missingTherapeuticUses.size > 0) {
      this.logger.warn(
        `${stats.missingTherapeuticUses.size} acciones terapéuticas referenciadas pero no encontradas en el catálogo: ${[...stats.missingTherapeuticUses].slice(0, 5).join(', ')}${stats.missingTherapeuticUses.size > 5 ? '…' : ''}`,
      );
    }
  }
}
