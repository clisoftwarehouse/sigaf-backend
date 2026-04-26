import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddReceiptFinancialBreakdown1777100000000 implements MigrationInterface {
  name = 'AddReceiptFinancialBreakdown1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // goods_receipt_items: descuento por línea y subtotal ya descontado.
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        ADD COLUMN IF NOT EXISTS discount_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipt_items
        ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(18, 4) NOT NULL DEFAULT 0
    `);

    // Backfill: para filas existentes, subtotal = quantity * unit_cost (sin descuento).
    await queryRunner.query(`
      UPDATE goods_receipt_items
         SET subtotal_usd = ROUND(quantity * unit_cost_usd, 4)
       WHERE subtotal_usd = 0
    `);

    // goods_receipts: breakdown de totales (subtotal, descuentos, IVA, IGTF).
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS subtotal_usd NUMERIC(18, 4) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS total_discount_usd NUMERIC(18, 4) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS tax_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS tax_usd NUMERIC(18, 4) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS igtf_pct NUMERIC(5, 2) NOT NULL DEFAULT 0
    `);
    await queryRunner.query(`
      ALTER TABLE goods_receipts
        ADD COLUMN IF NOT EXISTS igtf_usd NUMERIC(18, 4) NOT NULL DEFAULT 0
    `);

    // Backfill: para recepciones existentes, asumimos que total_usd era el subtotal
    // (sin impuestos ni descuentos agregados). Dejamos tax/igtf/descuentos en 0.
    await queryRunner.query(`
      UPDATE goods_receipts
         SET subtotal_usd = total_usd
       WHERE subtotal_usd = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS igtf_usd`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS igtf_pct`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS tax_usd`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS tax_pct`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS total_discount_usd`);
    await queryRunner.query(`ALTER TABLE goods_receipts DROP COLUMN IF EXISTS subtotal_usd`);
    await queryRunner.query(`ALTER TABLE goods_receipt_items DROP COLUMN IF EXISTS subtotal_usd`);
    await queryRunner.query(`ALTER TABLE goods_receipt_items DROP COLUMN IF EXISTS discount_pct`);
  }
}
