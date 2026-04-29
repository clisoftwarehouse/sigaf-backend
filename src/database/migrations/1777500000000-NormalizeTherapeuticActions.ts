import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Normaliza la "acción terapéutica" como FK 1:N desde principio activo
 * a `therapeutic_uses`, eliminando el texto libre `therapeutic_group`
 * y la tabla M:N `product_therapeutic_uses` (la acción ahora se deriva
 * del principio activo del producto).
 *
 * Migración de datos best-effort: hace match case-insensitive entre
 * `active_ingredients.therapeutic_group` y `therapeutic_uses.name`.
 * Lo que no calce queda NULL (asignación manual desde UI).
 */
export class NormalizeTherapeuticActions1777500000000 implements MigrationInterface {
  name = 'NormalizeTherapeuticActions1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "active_ingredients" ADD COLUMN IF NOT EXISTS "therapeutic_use_id" uuid`);

    await queryRunner.query(
      `ALTER TABLE "active_ingredients"
        ADD CONSTRAINT "FK_active_ingredients_therapeutic_use"
        FOREIGN KEY ("therapeutic_use_id") REFERENCES "therapeutic_uses"("id")
        ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_active_ingredients_therapeutic_use"
        ON "active_ingredients" ("therapeutic_use_id")
        WHERE "therapeutic_use_id" IS NOT NULL`,
    );

    await queryRunner.query(
      `UPDATE "active_ingredients" ai
        SET "therapeutic_use_id" = tu.id
        FROM "therapeutic_uses" tu
        WHERE ai.therapeutic_group IS NOT NULL
          AND LOWER(TRIM(ai.therapeutic_group)) = LOWER(TRIM(tu.name))`,
    );

    await queryRunner.query(`ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "therapeutic_group"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_therapeutic_uses_therapeutic_use"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_therapeutic_uses_product"`);
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses" DROP CONSTRAINT IF EXISTS "FK_product_therapeutic_uses_therapeutic_use"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses" DROP CONSTRAINT IF EXISTS "FK_product_therapeutic_uses_product"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_therapeutic_uses"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_therapeutic_uses" (
        "product_id" uuid NOT NULL,
        "therapeutic_use_id" uuid NOT NULL,
        CONSTRAINT "PK_product_therapeutic_uses" PRIMARY KEY ("product_id", "therapeutic_use_id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses"
        ADD CONSTRAINT "FK_product_therapeutic_uses_product"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses"
        ADD CONSTRAINT "FK_product_therapeutic_uses_therapeutic_use"
        FOREIGN KEY ("therapeutic_use_id") REFERENCES "therapeutic_uses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_therapeutic_uses_product" ON "product_therapeutic_uses" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_therapeutic_uses_therapeutic_use" ON "product_therapeutic_uses" ("therapeutic_use_id")`,
    );

    await queryRunner.query(
      `ALTER TABLE "active_ingredients" ADD COLUMN IF NOT EXISTS "therapeutic_group" character varying(100)`,
    );
    await queryRunner.query(
      `UPDATE "active_ingredients" ai
        SET "therapeutic_group" = tu.name
        FROM "therapeutic_uses" tu
        WHERE ai.therapeutic_use_id = tu.id`,
    );

    await queryRunner.query(`DROP INDEX IF EXISTS "idx_active_ingredients_therapeutic_use"`);
    await queryRunner.query(
      `ALTER TABLE "active_ingredients" DROP CONSTRAINT IF EXISTS "FK_active_ingredients_therapeutic_use"`,
    );
    await queryRunner.query(`ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "therapeutic_use_id"`);
  }
}
