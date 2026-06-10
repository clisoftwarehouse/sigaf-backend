import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Perfil clínico/CRM del cliente.
 *
 * Campos aditivos nullable en `customers` para el CRM de atención al
 * cliente. No rompe nada: los clientes existentes quedan con null y el
 * POS los muestra como "sin datos".
 *
 *  - allergies: alergias del paciente (texto libre, alerta al cajero).
 *  - chronic_conditions: condiciones crónicas (diabetes, HTA, etc.).
 *  - birth_date: para saludo de cumpleaños / edad.
 */
export class CustomerClinicalProfile1780000000012 implements MigrationInterface {
  name = 'CustomerClinicalProfile1780000000012';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "allergies" text`);
    await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "chronic_conditions" text`);
    await queryRunner.query(`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "birth_date" date`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "birth_date"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "chronic_conditions"`);
    await queryRunner.query(`ALTER TABLE "customers" DROP COLUMN IF EXISTS "allergies"`);
  }
}
