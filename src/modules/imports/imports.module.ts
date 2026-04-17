import { Module } from '@nestjs/common';

import { ImportsService } from './imports.service';
import { ImportsController } from './imports.controller';

/**
 * Módulo de importación masiva CSV/XLSX.
 *
 * No declara entidades TypeORM propias: utiliza el `DataSource` global
 * para operar directamente sobre las entidades de otros módulos
 * (products, branches, inventory_lots, prices, categories, brands)
 * con transacciones por-fila gestionadas vía `QueryRunner`.
 */
@Module({
  imports: [],
  controllers: [ImportsController],
  providers: [ImportsService],
  exports: [ImportsService],
})
export class ImportsModule {}
