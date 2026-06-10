import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Conexiones del récipe con prescribers y sale_tickets.
 *
 * Todos los cambios son ALTER ADD COLUMN nullable + FK SET NULL: las
 * filas existentes siguen funcionando, el resto del sistema no se rompe.
 *
 *   prescriptions.prescriber_id   FK al catálogo nuevo de médicos.
 *                                 Si está null, se sigue usando
 *                                 doctor_name + doctor_id_number como
 *                                 texto suelto (récipes legacy).
 *
 *   sale_tickets.prescription_id  FK al récipe que justificó la venta de
 *                                 controlados. Null para ventas sin
 *                                 producto que requiera récipe.
 */
export class PrescriptionLinkage1780000000010 implements MigrationInterface {
  name = 'PrescriptionLinkage1780000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // prescriptions.prescriber_id
    await queryRunner.query(`ALTER TABLE "prescriptions" ADD COLUMN IF NOT EXISTS "prescriber_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "prescriptions" ADD CONSTRAINT "prescriptions_prescriber_id_fkey" FOREIGN KEY ("prescriber_id") REFERENCES "prescribers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_prescriptions_prescriber" ON "prescriptions" ("prescriber_id") WHERE "prescriber_id" IS NOT NULL`,
    );

    // sale_tickets.prescription_id
    await queryRunner.query(`ALTER TABLE "sale_tickets" ADD COLUMN IF NOT EXISTS "prescription_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "sale_tickets" ADD CONSTRAINT "sale_tickets_prescription_id_fkey" FOREIGN KEY ("prescription_id") REFERENCES "prescriptions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sale_tickets_prescription" ON "sale_tickets" ("prescription_id") WHERE "prescription_id" IS NOT NULL`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "sale_tickets" DROP CONSTRAINT IF EXISTS "sale_tickets_prescription_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "sale_tickets" DROP COLUMN IF EXISTS "prescription_id"`);

    await queryRunner.query(`ALTER TABLE "prescriptions" DROP CONSTRAINT IF EXISTS "prescriptions_prescriber_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "prescriptions" DROP COLUMN IF EXISTS "prescriber_id"`);
  }
}
