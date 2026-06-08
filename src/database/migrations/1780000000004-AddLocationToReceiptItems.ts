import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddLocationToReceiptItems1780000000004 implements MigrationInterface {
  name = 'AddLocationToReceiptItems1780000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "location_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "goods_receipt_items_location_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "location_id"`);
  }
}
