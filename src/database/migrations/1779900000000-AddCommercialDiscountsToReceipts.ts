import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * QA #104: capturar los descuentos comerciales A NIVEL DE DOCUMENTO
 * (recepción), no solo en el maestro del proveedor. Hoy la recepción
 * sólo soporta el descuento lineal (por línea) — los otros 3 vivían en
 * el maestro como booleanos + % sugerido pero no había forma de
 * registrarlos en una factura específica.
 *
 * Tipos:
 *  - header_discount_pct: descuento aplicado al subtotal completo
 *  - prompt_payment_discount_pct: por pronto pago, sobre subtotal + IVA
 *  - volume_discount_pct: por volumen, sobre subtotal
 *
 * El descuento lineal sigue viviendo en goods_receipt_items.discount_pct.
 *
 * Los `_usd` son los montos calculados — se persisten para no recalcular
 * en cada reporte. Default 0 mantiene compat con recepciones existentes.
 */
export class AddCommercialDiscountsToReceipts1779900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      ['header_discount_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
      ['header_discount_usd', 'DECIMAL(18,4) NOT NULL DEFAULT 0'],
      ['prompt_payment_discount_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
      ['prompt_payment_discount_usd', 'DECIMAL(18,4) NOT NULL DEFAULT 0'],
      ['volume_discount_pct', 'DECIMAL(5,2) NOT NULL DEFAULT 0'],
      ['volume_discount_usd', 'DECIMAL(18,4) NOT NULL DEFAULT 0'],
    ];
    for (const [name, type] of cols) {
      await queryRunner.query(`ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "${name}" ${type}`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const cols = [
      'header_discount_pct',
      'header_discount_usd',
      'prompt_payment_discount_pct',
      'prompt_payment_discount_usd',
      'volume_discount_pct',
      'volume_discount_usd',
    ];
    for (const name of cols) {
      await queryRunner.query(`ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "${name}"`);
    }
  }
}
