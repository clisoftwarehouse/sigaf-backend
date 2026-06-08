import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddNativeUnitCostToReceiptItems1780000000005 implements MigrationInterface {
  name = 'AddNativeUnitCostToReceiptItems1780000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "unit_cost_native" numeric(18,4)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "unit_cost_native"`);
  }
}
