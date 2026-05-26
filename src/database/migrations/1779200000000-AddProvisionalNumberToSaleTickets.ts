import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Soporte para búsqueda de tickets por su número provisional offline.
 *
 * El POS asigna un número local (`T1-001`, `T2-005`, etc.) cuando cierra una
 * venta sin conexión. Ese número se imprime en el ticket del cliente como
 * único identificador. Cuando el ticket sincroniza, el backend le asigna su
 * `ticket_number` global del terminal, pero el cliente nunca lo ve — sigue
 * con su `T1-001` impreso.
 *
 * Si el cliente vuelve a OTRA terminal a devolver con ese ticket, esa otra
 * terminal:
 *   1. Busca local primero (puede no tenerlo cacheado).
 *   2. Pega al backend con el `provisional_number` y este columna permite
 *      resolverlo.
 *
 * Único parcial: dos terminales podrían generar el mismo provisional si la
 * sanitización falla, pero el constraint nos protege.
 */
export class AddProvisionalNumberToSaleTickets1779200000000 implements MigrationInterface {
  name = 'AddProvisionalNumberToSaleTickets1779200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE sale_tickets
      ADD COLUMN IF NOT EXISTS provisional_number varchar(30)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS ux_sale_tickets_provisional
      ON sale_tickets (provisional_number)
      WHERE provisional_number IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS ux_sale_tickets_provisional');
    await queryRunner.query('ALTER TABLE sale_tickets DROP COLUMN IF EXISTS provisional_number');
  }
}
