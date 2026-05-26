import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * QA #104 (refinamiento): el descuento por volumen necesita un umbral
 * configurable en el maestro del proveedor para poder calcularse
 * automáticamente en la recepción.
 *
 *  - volume_discount_threshold: número (>= 0) a partir del cual aplica
 *  - volume_discount_threshold_type:
 *      'quantity' → se compara contra la suma de cantidades facturadas
 *      'amount'   → se compara contra el subtotal en USD
 *
 * Ambos NULL por default. Si están definidos y el toggle hasVolumeDiscount
 * está activo, el frontend autocalcula el descuento al armar la recepción.
 */
export class AddVolumeDiscountThresholdToSuppliers1780000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "volume_discount_threshold" DECIMAL(18,4)`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "volume_discount_threshold_type" VARCHAR(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD CONSTRAINT "chk_volume_discount_threshold_type"
         CHECK ("volume_discount_threshold_type" IS NULL
                OR "volume_discount_threshold_type" IN ('quantity', 'amount'))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "suppliers" DROP CONSTRAINT IF EXISTS "chk_volume_discount_threshold_type"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "volume_discount_threshold_type"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "volume_discount_threshold"`);
  }
}
