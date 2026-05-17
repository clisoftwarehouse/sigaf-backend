import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Tickets de venta (POS) — tickets, items, payments y contadores por terminal.
 *
 * `ticket_number` es secuencial por terminal (numeración interna SIGAF, no
 * fiscal). El número de control fiscal lo asigna la impresora HKA al
 * imprimir; cuando llegue Fase 5 se persistirá en `control_number`.
 *
 * `client_uuid` es generado en el POS antes del request y permite dedup
 * más allá del Idempotency-Key (dos clientes distintos no pueden tener el
 * mismo client_uuid).
 *
 * Numeración atómica vía tabla `terminal_ticket_counters` con UPDATE ...
 * RETURNING para evitar contención.
 */
export class CreateSalesTables1778600000000 implements MigrationInterface {
  name = 'CreateSalesTables1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terminal_ticket_counters" (
        "terminal_id" uuid NOT NULL,
        "last_number" int NOT NULL DEFAULT 0,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_terminal_ticket_counters" PRIMARY KEY ("terminal_id"),
        CONSTRAINT "fk_terminal_ticket_counters_terminal" FOREIGN KEY ("terminal_id")
          REFERENCES "terminals"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_tickets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "client_uuid" uuid NOT NULL,
        "idempotency_key" varchar(100) NULL,
        "ticket_number" int NOT NULL,
        "control_number" varchar(50) NULL,
        "cash_session_id" uuid NOT NULL,
        "terminal_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "customer_id" uuid NULL,
        "salesperson_user_id" uuid NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'finalized',
        "type" varchar(10) NOT NULL DEFAULT 'sale',
        "reference_ticket_id" uuid NULL,
        "subtotal_exempt_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "subtotal_taxable_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "vat_amount_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "igtf_amount_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "total_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "total_paid_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "change_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "exchange_rate_usd_bs" numeric(18,6) NOT NULL,
        "total_bs" numeric(18,2) NOT NULL DEFAULT 0,
        "void_reason" text NULL,
        "voided_at" timestamptz NULL,
        "voided_by_user_id" uuid NULL,
        "client_created_at" timestamptz NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sale_tickets" PRIMARY KEY ("id"),
        CONSTRAINT "uq_sale_tickets_client_uuid" UNIQUE ("client_uuid"),
        CONSTRAINT "uq_sale_tickets_idempotency_key" UNIQUE ("idempotency_key"),
        CONSTRAINT "uq_sale_tickets_terminal_number" UNIQUE ("terminal_id", "ticket_number"),
        CONSTRAINT "ck_sale_tickets_status" CHECK ("status" IN ('finalized', 'voided')),
        CONSTRAINT "ck_sale_tickets_type" CHECK ("type" IN ('sale', 'return')),
        CONSTRAINT "ck_sale_tickets_total_nonneg" CHECK ("total_usd" >= 0),
        CONSTRAINT "ck_sale_tickets_voided_consistency" CHECK (
          ("status" = 'voided' AND "voided_at" IS NOT NULL)
          OR ("status" = 'finalized' AND "voided_at" IS NULL)
        ),
        CONSTRAINT "fk_sale_tickets_cash_session" FOREIGN KEY ("cash_session_id")
          REFERENCES "cash_sessions"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_terminal" FOREIGN KEY ("terminal_id")
          REFERENCES "terminals"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_customer" FOREIGN KEY ("customer_id")
          REFERENCES "customers"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_salesperson" FOREIGN KEY ("salesperson_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_reference" FOREIGN KEY ("reference_ticket_id")
          REFERENCES "sale_tickets"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_tickets_voided_by" FOREIGN KEY ("voided_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_tickets_branch_created"
      ON "sale_tickets" ("branch_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_tickets_cash_session"
      ON "sale_tickets" ("cash_session_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_tickets_customer"
      ON "sale_tickets" ("customer_id") WHERE "customer_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_tickets_status"
      ON "sale_tickets" ("status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_ticket_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sale_ticket_id" uuid NOT NULL,
        "line_number" int NOT NULL,
        "product_id" uuid NOT NULL,
        "lot_id" uuid NULL,
        "product_sku" varchar(100) NOT NULL,
        "product_name" varchar(255) NOT NULL,
        "unit_price_usd" numeric(18,4) NOT NULL,
        "vat_rate" numeric(5,4) NOT NULL DEFAULT 0,
        "discount_percent" numeric(5,2) NOT NULL DEFAULT 0,
        "quantity" numeric(12,3) NOT NULL,
        "line_subtotal_exempt_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "line_subtotal_taxable_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "line_vat_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "line_total_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "requires_rx" boolean NOT NULL DEFAULT false,
        "prescription_item_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sale_ticket_items" PRIMARY KEY ("id"),
        CONSTRAINT "uq_sale_ticket_items_line" UNIQUE ("sale_ticket_id", "line_number"),
        CONSTRAINT "ck_sale_ticket_items_qty_positive" CHECK ("quantity" > 0),
        CONSTRAINT "ck_sale_ticket_items_discount_range" CHECK (
          "discount_percent" >= 0 AND "discount_percent" <= 100
        ),
        CONSTRAINT "fk_sale_ticket_items_ticket" FOREIGN KEY ("sale_ticket_id")
          REFERENCES "sale_tickets"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sale_ticket_items_product" FOREIGN KEY ("product_id")
          REFERENCES "products"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_ticket_items_lot" FOREIGN KEY ("lot_id")
          REFERENCES "inventory_lots"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_sale_ticket_items_prescription_item" FOREIGN KEY ("prescription_item_id")
          REFERENCES "prescription_items"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_ticket_items_ticket"
      ON "sale_ticket_items" ("sale_ticket_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_ticket_items_product"
      ON "sale_ticket_items" ("product_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_ticket_payments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "sale_ticket_id" uuid NOT NULL,
        "payment_method" varchar(30) NOT NULL,
        "amount_usd" numeric(18,4) NOT NULL,
        "amount_bs" numeric(18,2) NOT NULL DEFAULT 0,
        "exchange_rate_used" numeric(18,6) NULL,
        "is_fx" boolean NOT NULL DEFAULT false,
        "reference_number" varchar(100) NULL,
        "card_last4" varchar(4) NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_sale_ticket_payments" PRIMARY KEY ("id"),
        CONSTRAINT "ck_sale_ticket_payments_method" CHECK (
          "payment_method" IN ('EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL', 'TDD', 'TDC', 'ZELLE', 'OTRO')
        ),
        CONSTRAINT "ck_sale_ticket_payments_amount_positive" CHECK ("amount_usd" > 0),
        CONSTRAINT "fk_sale_ticket_payments_ticket" FOREIGN KEY ("sale_ticket_id")
          REFERENCES "sale_tickets"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_sale_ticket_payments_ticket"
      ON "sale_ticket_payments" ("sale_ticket_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_ticket_payments_ticket"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_ticket_payments"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_ticket_items_product"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_ticket_items_ticket"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_ticket_items"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_tickets_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_tickets_customer"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_tickets_cash_session"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_sale_tickets_branch_created"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_tickets"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "terminal_ticket_counters"`);
  }
}
