import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Módulo de precios independiente (desacoplado del lote).
 *
 * Modelo:
 *   - `product_id` (obligatorio)
 *   - `branch_id`  (opcional → null = precio global, seteado = override por sucursal)
 *   - `price_usd`  SIEMPRE en USD (nunca en Bs). La conversión a VES ocurre en el POS
 *                  al momento de imprimir usando `exchange_rates`.
 *   - `effective_from` / `effective_to`: vigencia. `effective_to IS NULL` = precio vigente.
 *
 * La resolución de precio vigente para una venta sigue la prelación:
 *   1. override por sucursal (branch_id = X AND vigente)
 *   2. precio global (branch_id IS NULL AND vigente)
 *   3. fallback: `inventory_lots.sale_price` del lote disponible más reciente
 */
export class CreatePricesTable1776300400000 implements MigrationInterface {
  name = 'CreatePricesTable1776300400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prices" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "product_id" uuid NOT NULL,
        "branch_id" uuid NULL,
        "price_usd" numeric(18,4) NOT NULL,
        "effective_from" timestamptz NOT NULL DEFAULT now(),
        "effective_to" timestamptz NULL,
        "notes" text NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_prices" PRIMARY KEY ("id"),
        CONSTRAINT "ck_prices_price_usd_positive" CHECK ("price_usd" > 0),
        CONSTRAINT "ck_prices_effective_range" CHECK (
          "effective_to" IS NULL OR "effective_to" > "effective_from"
        ),
        CONSTRAINT "fk_prices_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_prices_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE CASCADE
      )
    `);

    // Unique activo por (producto, sucursal/null): solo puede haber UNA vigencia abierta
    // a la vez para el mismo scope. COALESCE trata NULL como UUID sintético.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_prices_active_scope"
      ON "prices" ("product_id", COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'::uuid))
      WHERE "effective_to" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prices_product_effective"
      ON "prices" ("product_id", "effective_from" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prices_branch"
      ON "prices" ("branch_id") WHERE "branch_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prices_branch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prices_product_effective"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_prices_active_scope"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prices"`);
  }
}
