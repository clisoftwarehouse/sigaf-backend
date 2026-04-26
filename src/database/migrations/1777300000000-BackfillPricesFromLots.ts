import { QueryRunner, MigrationInterface } from 'typeorm';

export class BackfillPricesFromLots1777300000000 implements MigrationInterface {
  name = 'BackfillPricesFromLots1777300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Para cada (producto, sucursal) con stock actual y `sale_price > 0`,
    // sembramos un registro en `prices` si aún no hay uno vigente. Esto permite
    // eliminar el fallback a `inventory_lots.sale_price` en `getCurrentPrice`.
    await queryRunner.query(`
      WITH latest_lot AS (
        SELECT DISTINCT ON (product_id, branch_id)
               product_id,
               branch_id,
               sale_price,
               created_by,
               created_at
          FROM inventory_lots
         WHERE sale_price > 0
           AND status = 'available'
         ORDER BY product_id, branch_id, created_at DESC
      )
      INSERT INTO prices (
        id, product_id, branch_id, price_usd, effective_from, effective_to,
        notes, created_by, created_at, updated_at
      )
      SELECT
        gen_random_uuid(),
        l.product_id,
        l.branch_id,
        l.sale_price,
        l.created_at,
        NULL,
        'Backfill desde lote existente — migración 1777300000000',
        l.created_by,
        NOW(),
        NOW()
      FROM latest_lot l
      WHERE NOT EXISTS (
        SELECT 1
          FROM prices p
         WHERE p.product_id = l.product_id
           AND ((p.branch_id IS NULL AND l.branch_id IS NULL)
                OR p.branch_id = l.branch_id)
           AND p.effective_to IS NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No removemos los precios sembrados para evitar pérdida de historial.
    // Si se requiere revertir, borrar manualmente los registros con el
    // prefijo "Backfill desde lote existente".
    await queryRunner.query(`SELECT 1`);
  }
}
