import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Compras Intelligence — Día 1.
 *
 * NO regresión: solo ADD COLUMN (nullable) en tablas existentes y CREATE
 * TABLE para las nuevas. Ninguna columna existente se renombra, dropea ni
 * cambia tipo. Ver memory/feedback_purchases_no_regression.md.
 *
 *  - drugstore_conditions: condiciones comerciales por droguería (cabecera,
 *    volumen, pronto pago). Scope opcional por producto o brand (laboratorio).
 *  - lab_conditions: condiciones por laboratorio (lineal, escala).
 *  - product_classifications: snapshot ABCD vigente por producto+sucursal.
 *  - ALTER supplier_products: campos del comparador (disponibilidad real,
 *    vencimiento del lote ofrecido, timestamp del precio).
 *  - ALTER purchase_order_items: snapshot de decisión + costo neto al crear OC.
 */
export class PurchasesIntelligence1780000000007 implements MigrationInterface {
  name = 'PurchasesIntelligence1780000000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── drugstore_conditions ────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "drugstore_conditions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "supplier_id" uuid NOT NULL,
        "product_id" uuid,
        "brand_id" uuid,
        "cabecera_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "volumen_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "pronto_pago_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "volumen_min_usd" numeric(18,4),
        "volumen_min_units" numeric(12,3),
        "credit_days" smallint DEFAULT 30,
        "delivery_days" smallint DEFAULT 2,
        "valid_from" date NOT NULL DEFAULT CURRENT_DATE,
        "valid_to" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "drugstore_conditions" ADD CONSTRAINT "drugstore_conditions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "drugstore_conditions" ADD CONSTRAINT "drugstore_conditions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "drugstore_conditions" ADD CONSTRAINT "drugstore_conditions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_dc_supplier" ON "drugstore_conditions" ("supplier_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_dc_product" ON "drugstore_conditions" ("product_id") WHERE "product_id" IS NOT NULL`,
    );

    // ─── lab_conditions ──────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lab_conditions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "brand_id" uuid NOT NULL,
        "supplier_id" uuid,
        "product_id" uuid,
        "lineal_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "escala_pct" numeric(5,2) NOT NULL DEFAULT 0,
        "escala_min_units" numeric(12,3),
        "valid_from" date NOT NULL DEFAULT CURRENT_DATE,
        "valid_to" date,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "lab_conditions" ADD CONSTRAINT "lab_conditions_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_conditions" ADD CONSTRAINT "lab_conditions_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "lab_conditions" ADD CONSTRAINT "lab_conditions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lc_brand" ON "lab_conditions" ("brand_id", "is_active")`);

    // ─── product_classifications (snapshot ABCD vigente) ─────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "product_classifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "product_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "abcd_class" char(1) NOT NULL,
        "score" numeric(5,2) NOT NULL,
        "is_pareto" boolean NOT NULL DEFAULT false,
        "forced_promotion_to_b" boolean NOT NULL DEFAULT false,
        "daily_velocity" numeric(12,4),
        "days_of_inventory" numeric(8,2),
        "days_since_last_sale" integer,
        "margin_pct" numeric(5,2),
        "seasonal_index_current" numeric(5,3),
        "expiry_signal" varchar(10),
        "component_rotation" numeric(4,3),
        "component_pareto" numeric(4,3),
        "component_margin" numeric(4,3),
        "component_inventory_days" numeric(4,3),
        "component_expiry" numeric(4,3),
        "calculated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "product_classifications_product_id_branch_id_key" UNIQUE ("product_id", "branch_id"),
        CONSTRAINT "product_classifications_abcd_class_check" CHECK ("abcd_class" IN ('A', 'B', 'C', 'D'))
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "product_classifications" ADD CONSTRAINT "product_classifications_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_classifications" ADD CONSTRAINT "product_classifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pc_class" ON "product_classifications" ("branch_id", "abcd_class")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_pc_pareto" ON "product_classifications" ("branch_id") WHERE "is_pareto" = true`,
    );

    // ─── ALTER supplier_products: campos del comparador ──────────────────
    // Todos nullable: las filas existentes quedan intactas.
    await queryRunner.query(`ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "available_qty" numeric(12,3)`);
    await queryRunner.query(`ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "lot_number" varchar(50)`);
    await queryRunner.query(`ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "lot_expiry_date" date`);
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD COLUMN IF NOT EXISTS "price_list_updated_at" timestamptz`,
    );

    // ─── ALTER purchase_order_items: snapshot al crear OC ────────────────
    // Todos nullable: las OCs existentes quedan intactas.
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "decision_at_creation" varchar(30)`,
    );
    await queryRunner.query(`ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "reason_at_creation" text`);
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD COLUMN IF NOT EXISTS "net_cost_usd_snapshot" numeric(18,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "net_cost_usd_snapshot"`);
    await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "reason_at_creation"`);
    await queryRunner.query(`ALTER TABLE "purchase_order_items" DROP COLUMN IF EXISTS "decision_at_creation"`);

    await queryRunner.query(`ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "price_list_updated_at"`);
    await queryRunner.query(`ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "lot_expiry_date"`);
    await queryRunner.query(`ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "lot_number"`);
    await queryRunner.query(`ALTER TABLE "supplier_products" DROP COLUMN IF EXISTS "available_qty"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "product_classifications"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "lab_conditions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "drugstore_conditions"`);
  }
}
