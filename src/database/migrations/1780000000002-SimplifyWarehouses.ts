import { QueryRunner, MigrationInterface } from 'typeorm';

export class SimplifyWarehouses1780000000002 implements MigrationInterface {
  name = 'SimplifyWarehouses1780000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "warehouse_locations" ADD COLUMN IF NOT EXISTS "name" varchar(100)`);
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" ADD COLUMN IF NOT EXISTS "is_for_sale" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" ADD COLUMN IF NOT EXISTS "is_for_purchase" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "warehouse_locations" DROP COLUMN IF EXISTS "is_for_purchase"`);
    await queryRunner.query(`ALTER TABLE "warehouse_locations" DROP COLUMN IF EXISTS "is_for_sale"`);
    await queryRunner.query(`ALTER TABLE "warehouse_locations" DROP COLUMN IF EXISTS "name"`);
  }
}
