import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * CxP — Cuentas por Pagar.
 *
 * Tablas nuevas. NO toca nada existente del módulo de compras
 * (ver memory/feedback_purchases_no_regression.md).
 *
 *   accounts_payable: una fila por factura/recepción aprobada.
 *   accounts_payable_payments: múltiples pagos parciales por CxP.
 *
 * El hook en createReceipt/reapproveReceipt corre fuera de la transacción
 * — si falla, la recepción sigue aprobada y el log queda warning.
 */
export class AccountsPayable1780000000008 implements MigrationInterface {
  name = 'AccountsPayable1780000000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── accounts_payable ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts_payable" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "supplier_id" uuid NOT NULL,
        "branch_id" uuid NOT NULL,
        "source_receipt_id" uuid,
        "invoice_number" varchar(50),
        "invoice_date" date NOT NULL,
        "due_date" date NOT NULL,
        "currency_native" char(3) NOT NULL DEFAULT 'USD',
        "original_amount_usd" numeric(18,4) NOT NULL,
        "original_amount_native" numeric(18,4) NOT NULL,
        "exchange_rate_at_creation" numeric(18,8),
        "paid_amount_usd" numeric(18,4) NOT NULL DEFAULT 0,
        "balance_usd" numeric(18,4) NOT NULL,
        "status" varchar(15) NOT NULL DEFAULT 'open',
        "payment_terms_days" smallint NOT NULL DEFAULT 30,
        "notes" text,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "accounts_payable_status_check"
          CHECK ("status" IN ('open', 'partial', 'paid', 'cancelled')),
        CONSTRAINT "accounts_payable_currency_check"
          CHECK ("currency_native" IN ('USD', 'VES'))
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "accounts_payable" ADD CONSTRAINT "accounts_payable_source_receipt_id_fkey" FOREIGN KEY ("source_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_branch_status_due" ON "accounts_payable" ("branch_id", "status", "due_date")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_supplier" ON "accounts_payable" ("supplier_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_receipt" ON "accounts_payable" ("source_receipt_id") WHERE "source_receipt_id" IS NOT NULL`,
    );

    // ─── accounts_payable_payments ───────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "accounts_payable_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "accounts_payable_id" uuid NOT NULL,
        "payment_date" date NOT NULL DEFAULT CURRENT_DATE,
        "amount_usd" numeric(18,4) NOT NULL,
        "amount_native" numeric(18,4) NOT NULL,
        "currency_native" char(3) NOT NULL DEFAULT 'USD',
        "exchange_rate" numeric(18,8),
        "method" varchar(20) NOT NULL,
        "reference" varchar(100),
        "bank_account_id" uuid,
        "notes" text,
        "paid_by_user_id" uuid NOT NULL,
        "reversed_at" timestamptz,
        "reversed_by_user_id" uuid,
        "reversed_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ap_payments_method_check"
          CHECK ("method" IN ('cash', 'transfer', 'check', 'dollars', 'mixed', 'other')),
        CONSTRAINT "ap_payments_currency_check"
          CHECK ("currency_native" IN ('USD', 'VES'))
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "accounts_payable_payments" ADD CONSTRAINT "ap_payments_cxp_fkey" FOREIGN KEY ("accounts_payable_id") REFERENCES "accounts_payable"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_payments_cxp" ON "accounts_payable_payments" ("accounts_payable_id", "reversed_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_ap_payments_date" ON "accounts_payable_payments" ("payment_date")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_payable_payments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "accounts_payable"`);
  }
}
