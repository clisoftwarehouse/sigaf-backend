import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Fase D - Soporte de bolívares (versión liviana).
 *
 * El sistema sigue siendo USD-first: inventario, pricing, kardex y reportes
 * operativos se mantienen en dólares. Esta migración solo agrega metadata
 * informativa y auditable para recepciones cuya factura física venga en VES.
 *
 * Cambios:
 *  1. `suppliers.invoices_in_currency`: pista para el formulario de recepción
 *     (USD por default; VES si el proveedor factura en bolívares). No bloquea
 *     nada — el operador puede sobreescribir caso por caso.
 *
 *  2. `goods_receipts.native_currency` / `native_total` / `exchange_rate_used` /
 *     `exchange_rate_id`: snapshot de la moneda y tasa al momento de registrar
 *     la recepción. Inmutables aunque la tasa BCV cambie después (auditoría
 *     contra factura física). El FK opcional permite trazar si fue tasa BCV
 *     oficial o un override manual.
 */
export class SupplierAndReceiptNativeCurrency1778000000000 implements MigrationInterface {
  name = 'SupplierAndReceiptNativeCurrency1778000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── suppliers.invoices_in_currency ────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE suppliers
        ADD COLUMN IF NOT EXISTS invoices_in_currency VARCHAR(3) NOT NULL DEFAULT 'USD'
    `);
    await queryRunner.query(`
      ALTER TABLE suppliers
        DROP CONSTRAINT IF EXISTS chk_suppliers_invoices_in_currency
    `);
    await queryRunner.query(`
      ALTER TABLE suppliers
        ADD CONSTRAINT chk_suppliers_invoices_in_currency
          CHECK (invoices_in_currency IN ('USD', 'VES'))
    `);

    // ─── goods_receipts: moneda original + tasa congelada ──────────────────
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS native_currency VARCHAR(3) NOT NULL DEFAULT 'USD'
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        DROP CONSTRAINT IF EXISTS chk_goods_receipts_native_currency
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD CONSTRAINT chk_goods_receipts_native_currency
          CHECK (native_currency IN ('USD', 'VES'))
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS native_total DECIMAL(18,4) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(18,4) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS exchange_rate_id UUID NULL
          REFERENCES exchange_rates(id) ON DELETE SET NULL
    `);

    // Reglas de consistencia: si la moneda nativa es VES, exigir total nativo
    // y tasa congelada. Si es USD, ambos deben quedar nulos (no tiene sentido
    // guardar tasa para una factura que ya viene en USD).
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        DROP CONSTRAINT IF EXISTS chk_goods_receipts_native_consistency
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD CONSTRAINT chk_goods_receipts_native_consistency
          CHECK (
            (native_currency = 'USD' AND native_total IS NULL AND exchange_rate_used IS NULL)
            OR
            (native_currency = 'VES' AND native_total IS NOT NULL AND exchange_rate_used IS NOT NULL)
          )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        DROP CONSTRAINT IF EXISTS chk_goods_receipts_native_consistency
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts DROP COLUMN IF EXISTS exchange_rate_id
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts DROP COLUMN IF EXISTS exchange_rate_used
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts DROP COLUMN IF EXISTS native_total
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        DROP CONSTRAINT IF EXISTS chk_goods_receipts_native_currency
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts DROP COLUMN IF EXISTS native_currency
    `);

    await queryRunner.query(`
      ALTER TABLE suppliers
        DROP CONSTRAINT IF EXISTS chk_suppliers_invoices_in_currency
    `);
    await queryRunner.query(`
      ALTER TABLE suppliers DROP COLUMN IF EXISTS invoices_in_currency
    `);
  }
}
