import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Tabla de clientes de la farmacia (B2C / B2B). Distinta de `users` que
 * son empleados. Soporta documentos venezolanos (V/E/J/G) y pasaportes (P).
 *
 * Restricciones:
 *  - `documentNumber` se guarda sin el prefijo del tipo.
 *  - Único por (`document_type`, `document_number`) entre clientes activos.
 *    Inactivos pueden duplicar para preservar histórico de ventas.
 *  - `default_discount_percent` 0..100 (validado a nivel app); aplica al
 *    momento de cobrar si no hay promo de mejor valor.
 *  - `credit_limit_usd` queda como espacio para futuras facturas a crédito.
 */
export class CreateCustomersTable1778200000000 implements MigrationInterface {
  name = 'CreateCustomersTable1778200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "customers" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_type" varchar(1) NOT NULL,
        "document_number" varchar(15) NOT NULL,
        "full_name" varchar(150) NOT NULL,
        "phone" varchar(30) NULL,
        "email" varchar(255) NULL,
        "address" text NULL,
        "customer_type" varchar(20) NOT NULL DEFAULT 'retail',
        "default_discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "credit_limit_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "notes" text NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_customers" PRIMARY KEY ("id"),
        CONSTRAINT "ck_customers_document_type" CHECK (
          "document_type" IN ('V', 'E', 'J', 'G', 'P')
        ),
        CONSTRAINT "ck_customers_customer_type" CHECK (
          "customer_type" IN ('retail', 'frecuente', 'corporativo')
        ),
        CONSTRAINT "ck_customers_discount_range" CHECK (
          "default_discount_percent" >= 0 AND "default_discount_percent" <= 100
        ),
        CONSTRAINT "ck_customers_credit_limit_nonneg" CHECK (
          "credit_limit_usd" >= 0
        )
      )
    `);

    // Único por documento entre activos. Permite reactivar borrados
    // o crear con un número antes usado por un inactivo (raro pero válido).
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_customers_document"
      ON "customers" ("document_type", "document_number")
      WHERE "is_active" = true
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_full_name"
      ON "customers" USING gin (to_tsvector('spanish', "full_name"))
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_customers_customer_type"
      ON "customers" ("customer_type") WHERE "is_active" = true
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_customer_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_customers_full_name"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_customers_document"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "customers"`);
  }
}
