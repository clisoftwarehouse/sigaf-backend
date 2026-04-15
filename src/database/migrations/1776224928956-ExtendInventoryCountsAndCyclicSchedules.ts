import { QueryRunner, MigrationInterface } from 'typeorm';

export class ExtendInventoryCountsAndCyclicSchedules1776224928956 implements MigrationInterface {
  name = 'ExtendInventoryCountsAndCyclicSchedules1776224928956';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "scope_description" text`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "scope_category_id" uuid`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "scope_location_ids" uuid[]`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "scope_abc_classes" char(1)[]`);
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "scope_risk_levels" character varying(10)[]`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "blocks_sales" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "blocked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "unblocked_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "total_skus_expected" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "total_skus_counted" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "total_skus_matched" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "total_skus_over" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "total_skus_short" integer`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "accuracy_pct" decimal(5,2)`);
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_counts" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );

    await queryRunner.query(`ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "location_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "expected_quantity" decimal(12,3) NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "expected_lot_number" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "expected_expiration_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "counted_lot_number" character varying(50)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "counted_expiration_date" date`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "counted_expiry_signal" character varying(10)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "difference_type" character varying(10)`,
    );
    await queryRunner.query(`ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "adjustment_id" uuid`);
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "device_type" character varying(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "is_recounted" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "recount_reason" text`);
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "is_synced" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "local_counted_at" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );

    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_blocked" boolean NOT NULL DEFAULT false`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_cyclic_schedules" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "branch_id" uuid NOT NULL,
        "name" character varying(100) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "abc_classes" char(1)[] NOT NULL,
        "risk_levels" character varying(10)[],
        "frequency_days" smallint NOT NULL DEFAULT 7,
        "max_skus_per_count" integer NOT NULL DEFAULT 50,
        "auto_generate" boolean NOT NULL DEFAULT true,
        "last_generated_at" TIMESTAMP WITH TIME ZONE,
        "next_generation_at" TIMESTAMP WITH TIME ZONE,
        "created_by" uuid NOT NULL,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_cyclic_schedules" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_inventory_cyclic_schedules_branch" ON "inventory_cyclic_schedules" ("branch_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_inventory_cyclic_schedules_branch"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_cyclic_schedules"`);

    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "inventory_blocked"`);

    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "local_counted_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "is_synced"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "recount_reason"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "is_recounted"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "device_type"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "adjustment_id"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "difference_type"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "counted_expiry_signal"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "counted_expiration_date"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "counted_lot_number"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "expected_expiration_date"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "expected_lot_number"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "expected_quantity"`);
    await queryRunner.query(`ALTER TABLE "inventory_count_items" DROP COLUMN IF EXISTS "location_id"`);

    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "completed_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "started_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "accuracy_pct"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "total_skus_short"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "total_skus_over"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "total_skus_matched"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "total_skus_counted"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "total_skus_expected"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "unblocked_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "blocked_at"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "blocks_sales"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "scope_risk_levels"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "scope_abc_classes"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "scope_location_ids"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "scope_category_id"`);
    await queryRunner.query(`ALTER TABLE "inventory_counts" DROP COLUMN IF EXISTS "scope_description"`);
  }
}
