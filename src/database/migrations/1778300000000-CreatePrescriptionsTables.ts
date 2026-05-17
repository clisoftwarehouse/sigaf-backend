import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Récipes médicos (prescriptions) y sus items.
 *
 * Necesarios para dispensar productos con `requiresRecipe = true`. Una venta
 * de producto controlado debe referenciar un `prescription_item.id` activo;
 * la lógica de dispensación incrementa `quantity_dispensed`.
 *
 * Estados del récipe: active, partially_dispensed, fully_dispensed,
 * expired (calculado vs `expires_at`), cancelled (anulado).
 */
export class CreatePrescriptionsTables1778300000000 implements MigrationInterface {
  name = 'CreatePrescriptionsTables1778300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "customer_id" uuid NOT NULL,
        "doctor_name" varchar(150) NOT NULL,
        "doctor_id_number" varchar(30) NULL,
        "prescription_number" varchar(50) NULL,
        "issued_at" timestamptz NOT NULL,
        "expires_at" timestamptz NULL,
        "status" varchar(30) NOT NULL DEFAULT 'active',
        "notes" text NULL,
        "image_url" varchar(500) NULL,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_prescriptions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_prescriptions_status" CHECK (
          "status" IN ('active', 'partially_dispensed', 'fully_dispensed', 'expired', 'cancelled')
        ),
        CONSTRAINT "ck_prescriptions_expires_after_issued" CHECK (
          "expires_at" IS NULL OR "expires_at" > "issued_at"
        ),
        CONSTRAINT "fk_prescriptions_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescriptions_customer"
      ON "prescriptions" ("customer_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescriptions_status"
      ON "prescriptions" ("status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescriptions_issued_at"
      ON "prescriptions" ("issued_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescription_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "prescription_id" uuid NOT NULL,
        "product_id" uuid NOT NULL,
        "quantity_prescribed" numeric(12,3) NOT NULL,
        "quantity_dispensed" numeric(12,3) NOT NULL DEFAULT 0,
        "posology" varchar(200) NULL,
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_prescription_items" PRIMARY KEY ("id"),
        CONSTRAINT "ck_prescription_items_qty_prescribed_positive" CHECK (
          "quantity_prescribed" > 0
        ),
        CONSTRAINT "ck_prescription_items_qty_dispensed_nonneg" CHECK (
          "quantity_dispensed" >= 0
        ),
        CONSTRAINT "ck_prescription_items_qty_dispensed_le_prescribed" CHECK (
          "quantity_dispensed" <= "quantity_prescribed"
        ),
        CONSTRAINT "fk_prescription_items_prescription" FOREIGN KEY ("prescription_id")
          REFERENCES "prescriptions"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_prescription_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescription_items_prescription"
      ON "prescription_items" ("prescription_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_prescription_items_product"
      ON "prescription_items" ("product_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescription_items_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescription_items_prescription"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescription_items"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescriptions_issued_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescriptions_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_prescriptions_customer"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "prescriptions"`);
  }
}
