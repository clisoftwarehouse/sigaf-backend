import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Prescribers (médicos).
 *
 * Tabla nueva normalizada. La entity `prescriptions` actualmente guarda
 * `doctor_name` y `doctor_id_number` como texto suelto — esto sigue
 * funcionando y no se rompe. Más adelante el récipe podrá referenciar
 * `prescriber_id` opcionalmente para auto-completar y reporting.
 *
 * Sin tocar tablas existentes (regla no-regresión).
 */
export class Prescribers1780000000009 implements MigrationInterface {
  name = 'Prescribers1780000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "prescribers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "full_name" varchar(150) NOT NULL,
        "specialty" varchar(100),
        "mpps_number" varchar(30),
        "national_id" varchar(20),
        "rif" varchar(20),
        "phone" varchar(30),
        "email" varchar(150),
        "address" text,
        "notes" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_by" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prescribers_active" ON "prescribers" ("is_active") WHERE "is_active" = true`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prescribers_mpps" ON "prescribers" ("mpps_number") WHERE "mpps_number" IS NOT NULL`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_prescribers_name" ON "prescribers" ("full_name")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "prescribers"`);
  }
}
