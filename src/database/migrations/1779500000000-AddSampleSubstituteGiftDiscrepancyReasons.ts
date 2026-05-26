import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Extiende `chk_discrepancy_reason` para soportar razones específicas de
 * productos ADICIONALES (los que llegaron sin estar en la OC):
 *   - sample: muestras gratis
 *   - substitute: sustituto enviado por el proveedor
 *   - commercial_gift: regalo / bonificación
 *
 * Estas tres clasificaciones permiten al área de compras conciliar mejor lo
 * que el proveedor manda fuera de pedido y entender por qué.
 */
export class AddSampleSubstituteGiftDiscrepancyReasons1779500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_item_discrepancies"
         DROP CONSTRAINT IF EXISTS "chk_discrepancy_reason"`,
    );
    await queryRunner.query(`
      ALTER TABLE "goods_receipt_item_discrepancies"
      ADD CONSTRAINT "chk_discrepancy_reason" CHECK (reason IN (
        'expired', 'defective', 'damaged_packaging', 'damaged_in_transit',
        'incorrect_product', 'missing', 'excess', 'quality_failure',
        'sample', 'substitute', 'commercial_gift', 'other'
      ))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_item_discrepancies"
         DROP CONSTRAINT IF EXISTS "chk_discrepancy_reason"`,
    );
    await queryRunner.query(`
      ALTER TABLE "goods_receipt_item_discrepancies"
      ADD CONSTRAINT "chk_discrepancy_reason" CHECK (reason IN (
        'expired', 'defective', 'damaged_packaging', 'damaged_in_transit',
        'incorrect_product', 'missing', 'excess', 'quality_failure', 'other'
      ))
    `);
  }
}
