import { QueryRunner, MigrationInterface } from 'typeorm';

export class WarehouseTransfers1780000000003 implements MigrationInterface {
  name = 'WarehouseTransfers1780000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_transfers" ADD COLUMN IF NOT EXISTS "from_location_id" uuid`);
    await queryRunner.query(`ALTER TABLE "inventory_transfers" ADD COLUMN IF NOT EXISTS "to_location_id" uuid`);
    await queryRunner.query(`ALTER TABLE "inventory_transfers" ADD COLUMN IF NOT EXISTS "source_receipt_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" ADD COLUMN IF NOT EXISTS "transfer_type" varchar(20) NOT NULL DEFAULT 'inter_branch'`,
    );

    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_from_location_id_fkey" FOREIGN KEY ("from_location_id") REFERENCES "warehouse_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_to_location_id_fkey" FOREIGN KEY ("to_location_id") REFERENCES "warehouse_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" ADD CONSTRAINT "inventory_transfers_source_receipt_id_fkey" FOREIGN KEY ("source_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventory_transfers_transfer_type" ON "inventory_transfers" ("transfer_type")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_inventory_transfers_transfer_type"`);
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" DROP CONSTRAINT IF EXISTS "inventory_transfers_source_receipt_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" DROP CONSTRAINT IF EXISTS "inventory_transfers_to_location_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfers" DROP CONSTRAINT IF EXISTS "inventory_transfers_from_location_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "inventory_transfers" DROP COLUMN IF EXISTS "transfer_type"`);
    await queryRunner.query(`ALTER TABLE "inventory_transfers" DROP COLUMN IF EXISTS "source_receipt_id"`);
    await queryRunner.query(`ALTER TABLE "inventory_transfers" DROP COLUMN IF EXISTS "to_location_id"`);
    await queryRunner.query(`ALTER TABLE "inventory_transfers" DROP COLUMN IF EXISTS "from_location_id"`);
  }
}
