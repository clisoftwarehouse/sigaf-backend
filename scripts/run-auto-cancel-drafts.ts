import 'reflect-metadata';
import 'dotenv/config';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from '../src/app.module';
import { PurchasesService } from '../src/modules/purchases/purchases.service';

/**
 * Dispara manualmente el cron `purchase-orders-auto-cancel-drafts` sin esperar
 * a las 3 AM. Útil para QA: actualizar `created_at` de una OC en draft a un
 * valor >30 días atrás y luego correr este script para verificar que pasa a
 * `cancelled`.
 *
 * Uso:
 *   npm run purchases:auto-cancel-drafts
 */
async function main() {
  const logger = new Logger('run-auto-cancel-drafts');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const service = app.get(PurchasesService);
    logger.log('Disparando autoCancelStaleDrafts()...');
    await service.autoCancelStaleDrafts();
    logger.log('Listo. Revisa el log del cron arriba para ver cuántas OCs se cancelaron.');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
