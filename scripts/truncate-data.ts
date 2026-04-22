import 'reflect-metadata';

import { AppDataSource } from '../src/database/data-source';

/**
 * Vacía todos los datos del schema preservando:
 * - La estructura (tablas, indexes, constraints, sequences)
 * - El registro de migraciones (tabla `migrations`)
 *
 * Útil para resetear la base de datos a un estado limpio sin tener que
 * volver a correr `schema:drop` + `migration:run`. Después de truncar,
 * típicamente se corre `npm run seed:run:relational` para re-poblar
 * roles, permisos, admin user y configs base.
 *
 * Uso:
 *   npm run db:truncate
 */
async function truncateData() {
  await AppDataSource.initialize();

  try {
    const result = await AppDataSource.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('migrations')`
    );
    const tables: string[] = result.map((r: { tablename: string }) => `"${r.tablename}"`);

    if (tables.length === 0) {
      console.log('No hay tablas que truncar.');
      return;
    }

    console.log(`Truncando ${tables.length} tabla(s)...`);
    await AppDataSource.query(`TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE`);
    console.log('✓ Datos eliminados. Schema y migraciones intactos.');
    console.log('Próximo paso sugerido: npm run seed:run:relational');
  } finally {
    await AppDataSource.destroy();
  }
}

void truncateData().catch((err) => {
  console.error('Error truncando datos:', err);
  process.exit(1);
});
