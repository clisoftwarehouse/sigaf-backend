import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * `bcv_rate_usd` en `global_config` quedó huérfana: la tasa BCV real que usa
 * la app (recepciones, conversiones VES↔USD) vive en la tabla `exchange_rates`,
 * gestionada desde la página /admin/exchange-rates. Esta clave nunca se leyó
 * desde código, así que la eliminamos para no confundir al admin.
 */
export class RemoveDeadBcvRateConfigKey1778100000000 implements MigrationInterface {
  name = 'RemoveDeadBcvRateConfigKey1778100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM global_config WHERE key = 'bcv_rate_usd'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO global_config (key, value, description, data_type)
      VALUES ('bcv_rate_usd', '36.50', 'Tasa BCV USD/VES', 'decimal')
      ON CONFLICT (key) DO NOTHING
    `);
  }
}
