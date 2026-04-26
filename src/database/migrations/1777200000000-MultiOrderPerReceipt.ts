import { QueryRunner, MigrationInterface } from 'typeorm';

export class MultiOrderPerReceipt1777200000000 implements MigrationInterface {
  name = 'MultiOrderPerReceipt1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cada ítem de recepción pasa a referenciar su propia OC para soportar
    // facturas que consolidan productos de múltiples órdenes.
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        ADD COLUMN IF NOT EXISTS purchase_order_id UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_goods_receipt_items_purchase_order_id
        ON goods_receipt_items (purchase_order_id)
    `);

    // Backfill: copiar la OC del header a cada ítem existente.
    await queryRunner.query(`
      UPDATE goods_receipt_items ri
         SET purchase_order_id = r.purchase_order_id
        FROM goods_receipts r
       WHERE ri.receipt_id = r.id
         AND r.purchase_order_id IS NOT NULL
         AND ri.purchase_order_id IS NULL
    `);

    // La OC del header queda redundante — la eliminamos.
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS purchase_order_id`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS purchase_order_id UUID NULL REFERENCES purchase_orders(id) ON DELETE SET NULL
    `);

    // Rellenamos con la primera OC encontrada en los ítems (mejor esfuerzo).
    await queryRunner.query(`
      UPDATE goods_receipts r
         SET purchase_order_id = sub.purchase_order_id
        FROM (
          SELECT DISTINCT ON (receipt_id) receipt_id, purchase_order_id
            FROM goods_receipt_items
           WHERE purchase_order_id IS NOT NULL
           ORDER BY receipt_id, created_at
        ) sub
       WHERE sub.receipt_id = r.id
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_goods_receipt_items_purchase_order_id`);
    await queryRunner.query(`ALTER TABLE goods_receipt_items DROP COLUMN IF EXISTS purchase_order_id`);
  }
}
