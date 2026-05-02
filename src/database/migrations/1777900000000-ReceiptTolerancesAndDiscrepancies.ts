import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Fase C - Recepción avanzada (PDF Política OC §5).
 *
 * Cambios:
 *  1. `goods_receipt_items.invoiced_quantity`: cantidad que dice la factura del
 *     proveedor. Junto con `quantity` (recibido físico) y la `quantity` de la
 *     OC asociada, permite cruzar 3 variables por línea y detectar faltantes
 *     vs sobrantes vs errores de facturación.
 *
 *  2. `goods_receipts.requires_reapproval` (boolean) + `reapproved_by` (uuid):
 *     marca que la recepción excedió tolerancia y necesita aprobación adicional
 *     antes de impactar inventario. El status se mantiene (purchase|consignment)
 *     pero el flag bloquea la creación de lotes.
 *
 *  3. Nueva tabla `goods_receipt_item_discrepancies`: motivos por los que la
 *     cantidad recibida difiere de lo facturado (vencido, dañado, etc.). La
 *     suma de cantidades por línea debe cuadrar con la diferencia reportada
 *     (validación a nivel de service).
 *
 *  4. Seed de las dos config keys de tolerancia (idempotente: ON CONFLICT DO
 *     NOTHING para no pisar overrides previos).
 */
export class ReceiptTolerancesAndDiscrepancies1777900000000 implements MigrationInterface {
  name = 'ReceiptTolerancesAndDiscrepancies1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── goods_receipt_items.invoiced_quantity ─────────────────────────────
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        ADD COLUMN IF NOT EXISTS invoiced_quantity DECIMAL(18,4)
    `);

    // ─── goods_receipt_items.lot_id nullable ───────────────────────────────
    // Recepciones con `requires_reapproval=true` no crean lotes hasta ser
    // reaprobadas. Permitimos NULL mientras tanto; el reapprove popula el FK.
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items ALTER COLUMN lot_id DROP NOT NULL
    `);

    // ─── goods_receipts: estado de reaprobación ────────────────────────────
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS requires_reapproval BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS reapproved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS reapproved_at TIMESTAMPTZ NULL
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS reapproval_justification TEXT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_goods_receipts_requires_reapproval
        ON goods_receipts (requires_reapproval) WHERE requires_reapproval = TRUE
    `);

    // ─── goods_receipt_item_discrepancies ──────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS goods_receipt_item_discrepancies (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        receipt_item_id UUID NOT NULL REFERENCES goods_receipt_items(id) ON DELETE CASCADE,
        reason VARCHAR(30) NOT NULL,
        quantity DECIMAL(18,4) NOT NULL,
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_discrepancy_reason CHECK (reason IN (
          'expired', 'defective', 'damaged_packaging', 'damaged_in_transit',
          'incorrect_product', 'missing', 'excess', 'quality_failure', 'other'
        )),
        CONSTRAINT chk_discrepancy_quantity_positive CHECK (quantity > 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_discrepancies_receipt_item
        ON goods_receipt_item_discrepancies (receipt_item_id)
    `);

    // ─── Seed de config keys (idempotente) ─────────────────────────────────
    await queryRunner.query(`
      INSERT INTO global_config (key, value, description, data_type)
      VALUES
        (
          'purchase_tolerance_quantity_pct',
          '5.00',
          'Tolerancia (%) de cantidad recibida vs ordenada en OC. Excederla bloquea la recepción y exige reaprobación.',
          'decimal'
        ),
        (
          'purchase_tolerance_cost_pct',
          '10.00',
          'Tolerancia (%) de desviación de costo unitario factura vs OC. Excederla bloquea la recepción y exige reaprobación.',
          'decimal'
        )
      ON CONFLICT (key) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM global_config
       WHERE key IN ('purchase_tolerance_quantity_pct', 'purchase_tolerance_cost_pct')
    `);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_discrepancies_receipt_item`);
    await queryRunner.query(`DROP TABLE IF EXISTS goods_receipt_item_discrepancies`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_goods_receipts_requires_reapproval`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS reapproval_justification`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS reapproved_at`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS reapproved_by`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS requires_reapproval`);

    // Devolver lot_id a NOT NULL solo si no hay nulls (defensivo).
    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM goods_receipt_items WHERE lot_id IS NULL) THEN
          ALTER TABLE goods_receipt_items ALTER COLUMN lot_id SET NOT NULL;
        END IF;
      END $$
    `);

    await queryRunner.query(`ALTER TABLE goods_receipt_items DROP COLUMN IF EXISTS invoiced_quantity`);
  }
}
