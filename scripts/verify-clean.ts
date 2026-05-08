import 'reflect-metadata';

import { AppDataSource } from '../src/database/data-source';

/** Reporte de conteo por tabla tras un truncate + seed. Solo lectura. */
async function verify() {
  await AppDataSource.initialize();
  try {
    const tables: string[] = (
      await AppDataSource.query(
        `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('migrations') ORDER BY tablename`
      )
    ).map((r: { tablename: string }) => r.tablename);

    const rows: Array<{ table: string; count: number }> = [];
    for (const t of tables) {
      const [{ count }] = await AppDataSource.query(`SELECT COUNT(*)::int AS count FROM "${t}"`);
      rows.push({ table: t, count });
    }

    const withData = rows.filter((r) => r.count > 0);
    const empty = rows.filter((r) => r.count === 0);

    console.log('\n=== Tablas con datos ===');
    for (const r of withData) console.log(`  ${r.table.padEnd(45)} ${r.count}`);
    console.log(`\n=== Tablas vacías: ${empty.length} ===`);
  } finally {
    await AppDataSource.destroy();
  }
}

void verify().catch((err) => {
  console.error(err);
  process.exit(1);
});
