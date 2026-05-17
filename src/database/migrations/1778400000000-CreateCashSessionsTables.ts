import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Sesiones de caja (turnos) y movimientos.
 *
 * Reglas:
 *  - Sólo UNA sesión `open` por terminal a la vez (unique parcial).
 *  - Movements son append-only. Correcciones = nuevo movement type='adjustment'.
 *  - Al cerrar la sesión, se persisten ambos (declared / calculated) y la
 *    diferencia. La diferencia es informativa, NO bloquea el cierre.
 */
export class CreateCashSessionsTables1778400000000 implements MigrationInterface {
  name = 'CreateCashSessionsTables1778400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "terminal_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "opened_by_user_id" uuid NOT NULL,
        "opened_at" timestamptz NOT NULL DEFAULT now(),
        "opening_amount_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "opening_amount_bs" numeric(18,2) NOT NULL DEFAULT 0,
        "closed_by_user_id" uuid NULL,
        "closed_at" timestamptz NULL,
        "closing_declared_usd" numeric(18,4) NULL,
        "closing_declared_bs" numeric(18,2) NULL,
        "closing_calculated_usd" numeric(18,4) NULL,
        "closing_calculated_bs" numeric(18,2) NULL,
        "difference_usd" numeric(18,4) NULL,
        "difference_bs" numeric(18,2) NULL,
        "status" varchar(20) NOT NULL DEFAULT 'open',
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_cash_sessions" PRIMARY KEY ("id"),
        CONSTRAINT "ck_cash_sessions_status" CHECK (
          "status" IN ('open', 'closed', 'audited')
        ),
        CONSTRAINT "ck_cash_sessions_close_consistency" CHECK (
          ("status" = 'open' AND "closed_at" IS NULL)
          OR ("status" IN ('closed', 'audited') AND "closed_at" IS NOT NULL)
        ),
        CONSTRAINT "ck_cash_sessions_amounts_nonneg" CHECK (
          "opening_amount_usd" >= 0 AND "opening_amount_bs" >= 0
        ),
        CONSTRAINT "fk_cash_sessions_terminal" FOREIGN KEY ("terminal_id")
          REFERENCES "terminals"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_cash_sessions_branch" FOREIGN KEY ("branch_id")
          REFERENCES "branches"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_cash_sessions_opened_by" FOREIGN KEY ("opened_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_cash_sessions_closed_by" FOREIGN KEY ("closed_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    // Sólo una sesión open por terminal a la vez.
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "ux_cash_sessions_open_per_terminal"
      ON "cash_sessions" ("terminal_id") WHERE "status" = 'open'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_sessions_terminal"
      ON "cash_sessions" ("terminal_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_sessions_branch"
      ON "cash_sessions" ("branch_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_sessions_opened_at"
      ON "cash_sessions" ("opened_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "cash_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "cash_session_id" uuid NOT NULL,
        "type" varchar(20) NOT NULL,
        "payment_method" varchar(30) NOT NULL,
        "amount_usd" numeric(18,4) NOT NULL,
        "amount_bs" numeric(18,2) NOT NULL DEFAULT 0,
        "exchange_rate_used" numeric(18,6) NULL,
        "reference_id" uuid NULL,
        "reference_type" varchar(30) NULL,
        "notes" text NULL,
        "created_by_user_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_cash_movements" PRIMARY KEY ("id"),
        CONSTRAINT "ck_cash_movements_type" CHECK (
          "type" IN ('opening', 'sale', 'return', 'payout', 'deposit', 'adjustment')
        ),
        CONSTRAINT "ck_cash_movements_method" CHECK (
          "payment_method" IN ('EFECTIVO_USD', 'EFECTIVO_BS', 'PAGO_MOVIL', 'TDD', 'TDC', 'ZELLE', 'OTRO')
        ),
        CONSTRAINT "fk_cash_movements_session" FOREIGN KEY ("cash_session_id")
          REFERENCES "cash_sessions"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_cash_movements_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_movements_session"
      ON "cash_movements" ("cash_session_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_cash_movements_reference"
      ON "cash_movements" ("reference_type", "reference_id")
      WHERE "reference_id" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_movements_reference"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_movements_session"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_movements"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_sessions_opened_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_sessions_branch"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_cash_sessions_terminal"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "ux_cash_sessions_open_per_terminal"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cash_sessions"`);
  }
}
