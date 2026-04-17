import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddProductInternalCodeSequence1776300000000 implements MigrationInterface {
  name = 'AddProductInternalCodeSequence1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Secuencia para generar códigos internos autoincrementales de productos.
    // Arranca en el siguiente valor después del máximo actual (si hay productos con
    // internal_code numérico-like ya existentes).
    await queryRunner.query(`
      DO $$
      DECLARE
        max_num INTEGER := 0;
      BEGIN
        SELECT COALESCE(MAX(CAST(SUBSTRING(internal_code FROM '^PROD-(\\d+)$') AS INTEGER)), 0)
          INTO max_num
          FROM products
         WHERE internal_code ~ '^PROD-\\d+$';

        EXECUTE format(
          'CREATE SEQUENCE IF NOT EXISTS products_internal_code_seq START WITH %s INCREMENT BY 1 MINVALUE 1 NO MAXVALUE CACHE 1',
          max_num + 1
        );
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP SEQUENCE IF EXISTS products_internal_code_seq`);
  }
}
