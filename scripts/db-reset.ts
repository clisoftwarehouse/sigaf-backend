import 'reflect-metadata';
import 'dotenv/config';

import { DataSource } from 'typeorm';

/**
 * Reset completo de la DB de desarrollo:
 *
 * 1. DROP SCHEMA + recrea todas las tablas vía `synchronize: true` desde las entities.
 * 2. Marca las 11 migraciones legacy del boilerplate como ya ejecutadas (porque
 *    nunca crearon el schema SIGAF — éste se creó originalmente vía synchronize
 *    y las migraciones posteriores asumen que ya existe).
 * 3. Crea la sequence `products_internal_code_seq` que TypeORM no genera desde
 *    entities (solo existe por la migración correspondiente).
 *
 * Después de correr este script:
 *   1. `npm run migration:run` → aplicará solo migraciones REALMENTE pendientes
 *      (ej. `1777000000000-QaPr1IntegrityConstraints`).
 *   2. `npm run seed:run:relational` → poblar roles/permisos/admin/configs.
 *
 * Uso:
 *   npm run db:reset
 */

const LEGACY_MIGRATIONS: Array<[bigint, string]> = [
  [1715028537217n, 'CreateUser1715028537217'],
  [1776040760516n, 'AddPurchasesAndConsignments1776040760516'],
  [1776216173294n, 'AddSencamerAndTherapeuticUses1776216173294'],
  [1776220204094n, 'ExtendBrandsAndSupplierContacts1776220204094'],
  [1776224928956n, 'ExtendInventoryCountsAndCyclicSchedules1776224928956'],
  [1776300000000n, 'AddProductInternalCodeSequence1776300000000'],
  [1776300100000n, 'SimplifyBrands1776300100000'],
  [1776300200000n, 'AddIsOverriddenToExchangeRates1776300200000'],
  [1776300300000n, 'AddAtcCodesToIngredientsAndTherapeuticUses1776300300000'],
  [1776300400000n, 'CreatePricesTable1776300400000'],
  [1776300500000n, 'CreatePromotionsTables1776300500000'],
];

async function dbReset() {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT ? parseInt(process.env.DATABASE_PORT, 10) : 5432,
    username: process.env.DATABASE_USERNAME,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: true,
    dropSchema: true,
    entities: [__dirname + '/../src/**/*.entity{.ts,.js}'],
    extra: {
      ssl:
        process.env.DATABASE_SSL_ENABLED === 'true'
          ? { rejectUnauthorized: process.env.DATABASE_REJECT_UNAUTHORIZED === 'true' }
          : undefined,
    },
  });

  console.log('► Inicializando DataSource (drop + recreate schema)...');
  await ds.initialize();
  console.log('  ✓ Schema recreado desde entities');

  console.log('► Asegurando tabla migrations...');
  await ds.query(
    `CREATE TABLE IF NOT EXISTS migrations (id SERIAL PRIMARY KEY, timestamp BIGINT NOT NULL, name VARCHAR NOT NULL)`,
  );

  console.log('► Marcando 11 migraciones legacy como ejecutadas...');
  for (const [ts, name] of LEGACY_MIGRATIONS) {
    const exists = await ds.query('SELECT 1 FROM migrations WHERE name = $1', [name]);
    if (exists.length === 0) {
      await ds.query('INSERT INTO migrations (timestamp, name) VALUES ($1, $2)', [ts.toString(), name]);
      console.log(`  ✓ ${name}`);
    } else {
      console.log(`  · ${name} (ya estaba)`);
    }
  }

  console.log('► Creando sequence products_internal_code_seq...');
  await ds.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'products_internal_code_seq') THEN
        CREATE SEQUENCE products_internal_code_seq START WITH 1 INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1;
      END IF;
    END $$;
  `);
  console.log('  ✓ Sequence lista');

  await ds.destroy();
  console.log('');
  console.log('✓ Reset completado.');
  console.log('');
  console.log('Próximos pasos:');
  console.log('  1. npm run migration:run        # aplica migraciones pendientes (ej. PR1 constraints)');
  console.log('  2. npm run seed:run:relational  # crea admin/admin123 + roles + permisos + configs');
}

void dbReset().catch((err) => {
  console.error('Error en reset:', err);
  process.exit(1);
});
