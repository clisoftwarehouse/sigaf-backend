import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Agrega 4 tipos de descuentos comerciales al maestro de proveedores. Útil
 * para análisis BI (qué proveedores ofrecen qué tipo de descuento y a qué
 * magnitud típica). Todos los flags son booleanos con default false; los
 * porcentajes son opcionales (decimal(5,2)) — el operador puede marcar el
 * switch sin conocer el % exacto.
 *
 * Tipos modelados:
 *   - header   : descuento aplicado al subtotal de la factura
 *   - linear   : descuento aplicado por línea de producto
 *   - prompt   : descuento por pronto pago (paga antes de N días)
 *   - volume   : descuento por volumen / cantidad mínima
 */
export class AddCommercialDiscountsToSuppliers1779000000000 implements MigrationInterface {
  name = 'AddCommercialDiscountsToSuppliers1779000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Switches (sí/no)
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "has_header_discount" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "has_linear_discount" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "has_prompt_payment_discount" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "has_volume_discount" boolean NOT NULL DEFAULT false`,
    );

    // Porcentajes típicos (opcionales: decimal(5,2) nullable, ej. 12.50)
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "header_discount_pct" decimal(5,2) NULL`);
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "linear_discount_pct" decimal(5,2) NULL`);
    await queryRunner.query(
      `ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "prompt_payment_discount_pct" decimal(5,2) NULL`,
    );
    await queryRunner.query(`ALTER TABLE "suppliers" ADD COLUMN IF NOT EXISTS "volume_discount_pct" decimal(5,2) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "volume_discount_pct"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "prompt_payment_discount_pct"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "linear_discount_pct"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "header_discount_pct"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "has_volume_discount"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "has_prompt_payment_discount"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "has_linear_discount"`);
    await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN IF EXISTS "has_header_discount"`);
  }
}
