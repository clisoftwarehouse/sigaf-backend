import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Número de control de la factura del proveedor.
 *
 * SENIAT (Providencia 0071, Art. 57 LIVA) exige que el Libro de Compras
 * registre el "número de control" de la factura del proveedor, distinto
 * del número de factura. Sin éste, el IVA soportado no genera crédito
 * fiscal en una fiscalización.
 *
 * Columna nullable y aditiva: las recepciones existentes no se rompen y
 * el Libro de Compras tolera el null mostrando "—". El operador la captura
 * en recepciones nuevas.
 */
export class AddControlNumberToReceipts1780000000011 implements MigrationInterface {
  name = 'AddControlNumberToReceipts1780000000011';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD COLUMN IF NOT EXISTS "supplier_control_number" varchar(50)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP COLUMN IF EXISTS "supplier_control_number"`);
  }
}
