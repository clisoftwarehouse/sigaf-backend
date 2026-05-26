import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Crea la tabla pivote `active_ingredient_therapeutic_uses` para soportar
 * la relación M2M entre principios activos y acciones terapéuticas.
 *
 * Hasta ahora cada PA tenía UNA acción primaria vía FK directa
 * (`active_ingredients.therapeutic_use_id`). El QA #100 pide multi-select:
 * un PA puede tener varias acciones (ej. ácido acetilsalicílico es
 * "Analgésico" + "Antiinflamatorio" + "Antiplaquetario").
 *
 * Estrategia:
 *  1. Crear tabla pivote (active_ingredient_id, therapeutic_use_id).
 *  2. Backfill: copiar el `therapeutic_use_id` actual de cada PA a la
 *     pivote como la primera entrada. Conserva la info existente.
 *  3. Dejar la FK directa nullable y deprecated. NO la borramos en esta
 *     migration para no romper queries legacy. Limpieza definitiva en
 *     un sprint posterior cuando confirmemos que nada la consulta.
 */
export class AddActiveIngredientTherapeuticUsesM2M1779700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Tabla pivote
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "active_ingredient_therapeutic_uses" (
        "active_ingredient_id" UUID NOT NULL REFERENCES "active_ingredients"("id") ON DELETE CASCADE,
        "therapeutic_use_id" UUID NOT NULL REFERENCES "therapeutic_uses"("id") ON DELETE CASCADE,
        PRIMARY KEY ("active_ingredient_id", "therapeutic_use_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_therapeutic_uses_ai"
        ON "active_ingredient_therapeutic_uses" ("active_ingredient_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_ai_therapeutic_uses_tu"
        ON "active_ingredient_therapeutic_uses" ("therapeutic_use_id")
    `);

    // 2. Backfill: copiar el valor actual de therapeutic_use_id a la pivote.
    //    ON CONFLICT DO NOTHING porque puede correr múltiples veces.
    await queryRunner.query(`
      INSERT INTO "active_ingredient_therapeutic_uses" (active_ingredient_id, therapeutic_use_id)
      SELECT id, therapeutic_use_id
      FROM "active_ingredients"
      WHERE therapeutic_use_id IS NOT NULL
      ON CONFLICT DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "active_ingredient_therapeutic_uses"`);
  }
}
