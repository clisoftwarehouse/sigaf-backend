import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Añade codificación estándar internacional:
 * - `active_ingredients.atc_code`   : código ATC (WHO) ej. "C09CA01" (losartán)
 * - `active_ingredients.inn_name`   : Denominación Común Internacional (INN)
 * - `therapeutic_uses.atc_code`     : nivel superior ATC (ej. "C09" = renina-angiotensina)
 */
export class AddAtcCodesToIngredientsAndTherapeuticUses1776300300000 implements MigrationInterface {
  name = 'AddAtcCodesToIngredientsAndTherapeuticUses1776300300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "active_ingredients" ADD COLUMN IF NOT EXISTS "atc_code" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "active_ingredients" ADD COLUMN IF NOT EXISTS "inn_name" character varying(200)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_active_ingredients_atc" ON "active_ingredients" ("atc_code") WHERE "atc_code" IS NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "therapeutic_uses" ADD COLUMN IF NOT EXISTS "atc_code" character varying(20)`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_therapeutic_uses_atc" ON "therapeutic_uses" ("atc_code") WHERE "atc_code" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_therapeutic_uses_atc"`);
    await queryRunner.query(`ALTER TABLE "therapeutic_uses" DROP COLUMN IF EXISTS "atc_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_active_ingredients_atc"`);
    await queryRunner.query(`ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "inn_name"`);
    await queryRunner.query(`ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "atc_code"`);
  }
}
