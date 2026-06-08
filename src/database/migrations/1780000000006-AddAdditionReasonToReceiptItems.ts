import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddAdditionReasonToReceiptItems1780000000006 implements MigrationInterface {
  name = 'AddAdditionReasonToReceiptItems1780000000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" ADD COLUMN IF NOT EXISTS "addition_reason" varchar(30)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" DROP COLUMN IF EXISTS "addition_reason"`);
  }
}
