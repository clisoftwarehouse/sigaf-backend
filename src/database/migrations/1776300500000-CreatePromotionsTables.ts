import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Módulo de promociones y descuentos.
 *
 * `promotions`:
 *   - type: 'percentage' (value = 0..100 = %) |
 *           'fixed_amount' (value = USD off por unidad) |
 *           'buy_x_get_y' (buy_quantity + get_quantity)
 *   - Todos los montos son en USD (jamás en Bs).
 *   - Vigencia obligatoria (effective_from) + opcional (effective_to).
 *   - `max_uses` limita usos totales; `uses_count` se incrementa al consumir.
 *   - `priority`: mayor gana cuando hay múltiples aplicables y no son `stackable`.
 *
 * `promotion_scopes`:
 *   - Aplicabilidad polimórfica por product / category / branch.
 *   - Convención: si una promoción NO tiene scopes de tipo 'product' ni 'category',
 *     aplica a todos los productos. Idem para 'branch' → todas las sucursales.
 *   - Constraint unique evita duplicados (misma promo + mismo scope).
 */
export class CreatePromotionsTables1776300500000 implements MigrationInterface {
  name = 'CreatePromotionsTables1776300500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" varchar(200) NOT NULL,
        "description" text NULL,
        "type" varchar(20) NOT NULL,
        "value" numeric(18,4) NOT NULL DEFAULT 0,
        "buy_quantity" integer NULL,
        "get_quantity" integer NULL,
        "min_quantity" numeric(12,3) NOT NULL DEFAULT 1,
        "max_uses" integer NULL,
        "uses_count" integer NOT NULL DEFAULT 0,
        "priority" integer NOT NULL DEFAULT 0,
        "stackable" boolean NOT NULL DEFAULT false,
        "effective_from" timestamptz NOT NULL DEFAULT now(),
        "effective_to" timestamptz NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_promotions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_promotions_type" CHECK ("type" IN ('percentage','fixed_amount','buy_x_get_y')),
        CONSTRAINT "ck_promotions_value_nonneg" CHECK ("value" >= 0),
        CONSTRAINT "ck_promotions_percentage_range" CHECK (
          "type" <> 'percentage' OR ("value" > 0 AND "value" <= 100)
        ),
        CONSTRAINT "ck_promotions_bxgy_qty" CHECK (
          "type" <> 'buy_x_get_y' OR ("buy_quantity" >= 1 AND "get_quantity" >= 1)
        ),
        CONSTRAINT "ck_promotions_min_quantity" CHECK ("min_quantity" > 0),
        CONSTRAINT "ck_promotions_max_uses" CHECK ("max_uses" IS NULL OR "max_uses" > 0),
        CONSTRAINT "ck_promotions_uses_count" CHECK ("uses_count" >= 0),
        CONSTRAINT "ck_promotions_effective_range" CHECK (
          "effective_to" IS NULL OR "effective_to" > "effective_from"
        )
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_promotions_active_window"
      ON "promotions" ("is_active", "effective_from", "effective_to")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_promotions_priority"
      ON "promotions" ("priority" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "promotion_scopes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "promotion_id" uuid NOT NULL,
        "scope_type" varchar(20) NOT NULL,
        "scope_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_promotion_scopes" PRIMARY KEY ("id"),
        CONSTRAINT "fk_promotion_scopes_promotion" FOREIGN KEY ("promotion_id")
          REFERENCES "promotions"("id") ON DELETE CASCADE,
        CONSTRAINT "ck_promotion_scopes_type" CHECK ("scope_type" IN ('product','category','branch')),
        CONSTRAINT "ux_promotion_scopes_unique" UNIQUE ("promotion_id","scope_type","scope_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_promotion_scopes_lookup"
      ON "promotion_scopes" ("scope_type", "scope_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_promotion_scopes_promotion"
      ON "promotion_scopes" ("promotion_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_promotion_scopes_promotion"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_promotion_scopes_lookup"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotion_scopes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_promotions_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_promotions_active_window"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "promotions"`);
  }
}
