import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Relaja la check `ck_sale_ticket_payments_amount_positive` de `> 0` a `<> 0`
 * para permitir montos NEGATIVOS en payments de tickets type='return'. El
 * código de devolución ya los inserta negativos (sales.service.ts ~line 830)
 * para que reportes que suman amount_usd reflejen direccionalmente la salida
 * de dinero; lo mismo hace `cash_movements`. La constraint vieja rompía
 * cualquier intento de procesar una devolución.
 */
export class AllowNegativeAmountInSaleTicketPayments1779300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_ticket_payments"
         DROP CONSTRAINT IF EXISTS "ck_sale_ticket_payments_amount_positive"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_ticket_payments"
         ADD CONSTRAINT "ck_sale_ticket_payments_amount_nonzero"
         CHECK ("amount_usd" <> 0)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "sale_ticket_payments"
         DROP CONSTRAINT IF EXISTS "ck_sale_ticket_payments_amount_nonzero"`,
    );
    await queryRunner.query(
      `ALTER TABLE "sale_ticket_payments"
         ADD CONSTRAINT "ck_sale_ticket_payments_amount_positive"
         CHECK ("amount_usd" > 0)`,
    );
  }
}
