import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Tabla de soporte para idempotencia HTTP. Usada por el interceptor en POSTs
 * transaccionales para deduplicar reintentos del cliente (POS offline, etc.).
 *
 * TTL típico: 72 horas. Un job/cron puede limpiar registros expirados;
 * aceptable que crezca lentamente — la PK es la `key` del cliente.
 */
export class CreateIdempotencyKeysTable1778500000000 implements MigrationInterface {
  name = 'CreateIdempotencyKeysTable1778500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "idempotency_keys" (
        "key" varchar(100) NOT NULL,
        "endpoint" varchar(200) NOT NULL,
        "request_hash" varchar(64) NOT NULL,
        "status_code" int NULL,
        "response_body" jsonb NULL,
        "user_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "expires_at" timestamptz NOT NULL,
        "locked_until" timestamptz NULL,
        CONSTRAINT "pk_idempotency_keys" PRIMARY KEY ("key")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_idempotency_keys_expires"
      ON "idempotency_keys" ("expires_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_idempotency_keys_expires"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "idempotency_keys"`);
  }
}
