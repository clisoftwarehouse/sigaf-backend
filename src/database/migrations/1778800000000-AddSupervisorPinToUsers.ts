import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * PIN de supervisor: 4-6 dígitos numéricos, hashed con bcrypt. Usado por
 * `POST /v1/auth/verify-pin` para autorizar overrides en el POS (descuento
 * manual, anular venta, etc.).
 *
 * Nullable: usuarios sin PIN no pueden ser supervisores. El PIN se setea
 * via PATCH /v1/users/:id/pin (admin) o /v1/auth/me/pin (self-service).
 */
export class AddSupervisorPinToUsers1778800000000 implements MigrationInterface {
  name = 'AddSupervisorPinToUsers1778800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "supervisor_pin_hash" varchar(255) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users" DROP COLUMN IF EXISTS "supervisor_pin_hash"
    `);
  }
}
