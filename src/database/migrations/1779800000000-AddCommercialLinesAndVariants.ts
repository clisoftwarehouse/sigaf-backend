import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * QA #93: convierte los strings libres `products.commercial_line` y
 * `products.commercial_variant` en entidades reusables (igual que categorías
 * o marcas), para evitar que cada operador invente su propia ortografía.
 *
 * Estrategia:
 *  1. Crear tablas `commercial_lines` y `commercial_variants` (id, name unique).
 *  2. Agregar a `products` las columnas FK `commercial_line_id` y
 *     `commercial_variant_id` (nullable).
 *  3. Backfill: para cada string distinto en las columnas viejas, insertar
 *     un registro en la tabla nueva y vincular los productos. Case-insensitive
 *     trim para no duplicar variantes que solo difieren en caps.
 *  4. NO eliminamos las columnas viejas en esta migration — siguen
 *     soportadas como display secundario. Limpieza definitiva en otro sprint
 *     cuando confirmemos que nada las consulta.
 */
export class AddCommercialLinesAndVariants1779800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tablas
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "commercial_lines" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(120) NOT NULL UNIQUE,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "commercial_variants" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" VARCHAR(120) NOT NULL UNIQUE,
        "is_active" BOOLEAN NOT NULL DEFAULT true,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // 2. FKs en products
    await queryRunner.query(
      `ALTER TABLE "products"
         ADD COLUMN IF NOT EXISTS "commercial_line_id" UUID
         REFERENCES "commercial_lines"("id") ON DELETE SET NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "products"
         ADD COLUMN IF NOT EXISTS "commercial_variant_id" UUID
         REFERENCES "commercial_variants"("id") ON DELETE SET NULL`,
    );

    // 3. Backfill: insertar valores distintos y vincular productos.
    //    TRIM + NULLIF para descartar strings vacíos o solo whitespace.
    await queryRunner.query(`
      INSERT INTO "commercial_lines" ("name")
      SELECT DISTINCT INITCAP(TRIM(commercial_line))
      FROM "products"
      WHERE NULLIF(TRIM(commercial_line), '') IS NOT NULL
      ON CONFLICT ("name") DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO "commercial_variants" ("name")
      SELECT DISTINCT INITCAP(TRIM(commercial_variant))
      FROM "products"
      WHERE NULLIF(TRIM(commercial_variant), '') IS NOT NULL
      ON CONFLICT ("name") DO NOTHING
    `);

    // Vincular productos a las nuevas filas creadas, match case-insensitive
    // trimeado contra los strings legacy.
    await queryRunner.query(`
      UPDATE "products" p
      SET "commercial_line_id" = cl."id"
      FROM "commercial_lines" cl
      WHERE LOWER(TRIM(p.commercial_line)) = LOWER(cl.name)
        AND p.commercial_line_id IS NULL
    `);
    await queryRunner.query(`
      UPDATE "products" p
      SET "commercial_variant_id" = cv."id"
      FROM "commercial_variants" cv
      WHERE LOWER(TRIM(p.commercial_variant)) = LOWER(cv.name)
        AND p.commercial_variant_id IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercial_variant_id"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercial_line_id"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commercial_variants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "commercial_lines"`);
  }
}
