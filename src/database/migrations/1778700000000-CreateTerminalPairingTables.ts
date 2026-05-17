import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Pairing por equipo (no por sesión de cajero).
 *
 *  - `terminal_pairing_codes`: códigos de un solo uso emitidos por el admin.
 *    El instalador los introduce en el PC nuevo y consume el código contra
 *    /v1/terminals/pair, recibiendo el apiKey del equipo.
 *  - `terminal_api_keys`: hashes bcrypt de las apiKey por terminal. Las keys
 *    son long-lived; admin puede revocarlas. El POS guarda la apiKey local
 *    (Stronghold en Fase 3) y la envía como header `X-Terminal-API-Key` en
 *    cada request POS-only.
 *
 * Esto materializa la decisión arquitectural: el `terminal_id` lo aporta
 * el equipo físico (apiKey), no la sesión del usuario.
 */
export class CreateTerminalPairingTables1778700000000 implements MigrationInterface {
  name = 'CreateTerminalPairingTables1778700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terminal_pairing_codes" (
        "code" varchar(20) NOT NULL,
        "terminal_id" uuid NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "consumed_at" timestamptz NULL,
        "consumed_by_user_id" uuid NULL,
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_terminal_pairing_codes" PRIMARY KEY ("code"),
        CONSTRAINT "fk_terminal_pairing_codes_terminal" FOREIGN KEY ("terminal_id")
          REFERENCES "terminals"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_terminal_pairing_codes_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_terminal_pairing_codes_consumed_by" FOREIGN KEY ("consumed_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_terminal_pairing_codes_terminal"
      ON "terminal_pairing_codes" ("terminal_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_terminal_pairing_codes_expires"
      ON "terminal_pairing_codes" ("expires_at") WHERE "consumed_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "terminal_api_keys" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "terminal_id" uuid NOT NULL,
        "key_prefix" varchar(20) NOT NULL,
        "key_hash" varchar(255) NOT NULL,
        "label" varchar(100) NULL,
        "last_used_at" timestamptz NULL,
        "revoked_at" timestamptz NULL,
        "revoked_by_user_id" uuid NULL,
        "created_by_user_id" uuid NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_terminal_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "fk_terminal_api_keys_terminal" FOREIGN KEY ("terminal_id")
          REFERENCES "terminals"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_terminal_api_keys_revoked_by" FOREIGN KEY ("revoked_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_terminal_api_keys_created_by" FOREIGN KEY ("created_by_user_id")
          REFERENCES "users"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_terminal_api_keys_terminal"
      ON "terminal_api_keys" ("terminal_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_terminal_api_keys_prefix"
      ON "terminal_api_keys" ("key_prefix") WHERE "revoked_at" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_terminal_api_keys_prefix"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_terminal_api_keys_terminal"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "terminal_api_keys"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_terminal_pairing_codes_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_terminal_pairing_codes_terminal"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "terminal_pairing_codes"`);
  }
}
