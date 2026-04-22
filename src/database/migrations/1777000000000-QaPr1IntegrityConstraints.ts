import { QueryRunner, MigrationInterface } from 'typeorm';

export class QaPr1IntegrityConstraints1777000000000 implements MigrationInterface {
  name = 'QaPr1IntegrityConstraints1777000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Active ingredients: el default cambió de true a false (lógica de un único primary
    // ahora la maneja el service). Normalizamos registros existentes para que
    // a lo sumo uno por producto quede como primary.
    await queryRunner.query(`
      ALTER TABLE product_active_ingredients ALTER COLUMN is_primary SET DEFAULT false
    `);

    await queryRunner.query(`
      WITH ranked AS (
        SELECT product_id, active_ingredient_id,
               ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY active_ingredient_id) AS rn,
               is_primary
          FROM product_active_ingredients
      )
      UPDATE product_active_ingredients pai
         SET is_primary = false
        FROM ranked r
       WHERE pai.product_id = r.product_id
         AND pai.active_ingredient_id = r.active_ingredient_id
         AND r.rn > 1
         AND pai.is_primary = true
    `);

    // Garantizamos que cada producto con ingredientes tenga al menos uno marcado primary.
    await queryRunner.query(`
      WITH first_per_product AS (
        SELECT DISTINCT ON (product_id) product_id, active_ingredient_id
          FROM product_active_ingredients
         ORDER BY product_id, active_ingredient_id
      ),
      missing_primary AS (
        SELECT pai.product_id
          FROM product_active_ingredients pai
         GROUP BY pai.product_id
        HAVING bool_or(pai.is_primary) = false
      )
      UPDATE product_active_ingredients pai
         SET is_primary = true
        FROM first_per_product fp
        JOIN missing_primary mp ON mp.product_id = fp.product_id
       WHERE pai.product_id = fp.product_id
         AND pai.active_ingredient_id = fp.active_ingredient_id
    `);

    // Barcodes: misma normalización (a lo sumo un primary por producto).
    await queryRunner.query(`
      WITH ranked AS (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY product_id, is_primary ORDER BY created_at, id) AS rn,
               is_primary, product_id
          FROM product_barcodes
         WHERE is_primary = true
      )
      UPDATE product_barcodes pb
         SET is_primary = false
        FROM ranked r
       WHERE pb.id = r.id
         AND r.rn > 1
    `);

    // Defensa a nivel DB: un único primary por producto en barcodes e ingredientes.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_barcodes_one_primary
        ON product_barcodes (product_id) WHERE is_primary = true
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_product_ingredients_one_primary
        ON product_active_ingredients (product_id) WHERE is_primary = true
    `);

    // Categories: defensa para code único entre categorías activas.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_code_active
        ON categories (code) WHERE is_active = true AND code IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_categories_code_active`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_ingredients_one_primary`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_product_barcodes_one_primary`);
    await queryRunner.query(`
      ALTER TABLE product_active_ingredients ALTER COLUMN is_primary SET DEFAULT true
    `);
  }
}
