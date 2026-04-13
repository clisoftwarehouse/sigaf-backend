import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddPurchasesAndConsignments1776040760516 implements MigrationInterface {
  name = 'AddPurchasesAndConsignments1776040760516';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_role_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "terminals" DROP CONSTRAINT IF EXISTS "terminals_branch_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "purchase_order_items_order_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "purchase_order_items_product_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_branch_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_created_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" DROP CONSTRAINT IF EXISTS "purchase_orders_approved_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "goods_receipt_items_receipt_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "goods_receipt_items_product_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "goods_receipt_items_lot_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_branch_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_purchase_order_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_supplier_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" DROP CONSTRAINT IF EXISTS "goods_receipts_received_by_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" DROP CONSTRAINT IF EXISTS "product_substitutes_product_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" DROP CONSTRAINT IF EXISTS "product_substitutes_substitute_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" DROP CONSTRAINT IF EXISTS "product_active_ingredients_product_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" DROP CONSTRAINT IF EXISTS "product_active_ingredients_active_ingredient_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_brand_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "supplier_products_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "supplier_products_product_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "user_sessions_user_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" DROP CONSTRAINT IF EXISTS "warehouse_locations_branch_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "kardex" DROP CONSTRAINT IF EXISTS "kardex_product_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "kardex" DROP CONSTRAINT IF EXISTS "kardex_branch_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "kardex" DROP CONSTRAINT IF EXISTS "kardex_lot_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "kardex" DROP CONSTRAINT IF EXISTS "kardex_user_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "kardex" DROP CONSTRAINT IF EXISTS "kardex_terminal_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_role_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_permission_id_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_product_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_branch_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_supplier_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_location_id_fkey"`);
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" DROP CONSTRAINT IF EXISTS "consignment_return_items_return_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" DROP CONSTRAINT IF EXISTS "consignment_return_items_consignment_item_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" DROP CONSTRAINT IF EXISTS "consignment_return_items_lot_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" DROP CONSTRAINT IF EXISTS "consignment_returns_consignment_entry_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" DROP CONSTRAINT IF EXISTS "consignment_returns_branch_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" DROP CONSTRAINT IF EXISTS "consignment_returns_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" DROP CONSTRAINT IF EXISTS "consignment_returns_processed_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" DROP CONSTRAINT IF EXISTS "consignment_liquidations_branch_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" DROP CONSTRAINT IF EXISTS "consignment_liquidations_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" DROP CONSTRAINT IF EXISTS "consignment_liquidations_approved_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" DROP CONSTRAINT IF EXISTS "consignment_liquidations_created_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" DROP CONSTRAINT IF EXISTS "consignment_liquidation_items_liquidation_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" DROP CONSTRAINT IF EXISTS "consignment_liquidation_items_consignment_item_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" DROP CONSTRAINT IF EXISTS "consignment_entry_items_consignment_entry_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" DROP CONSTRAINT IF EXISTS "consignment_entry_items_product_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" DROP CONSTRAINT IF EXISTS "consignment_entry_items_lot_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" DROP CONSTRAINT IF EXISTS "consignment_entries_branch_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" DROP CONSTRAINT IF EXISTS "consignment_entries_supplier_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" DROP CONSTRAINT IF EXISTS "consignment_entries_received_by_fkey"`,
    );
    await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_user_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "audit_log" DROP CONSTRAINT IF EXISTS "audit_log_terminal_id_fkey"`);
    await queryRunner.query(`ALTER TABLE "global_config" DROP CONSTRAINT IF EXISTS "global_config_updated_by_fkey"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_inventory_lots_product"`);
    await queryRunner.query(`ALTER TABLE "product_substitutes" DROP CONSTRAINT IF EXISTS "product_substitutes_check"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "supplier_products_supplier_id_product_id_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" DROP CONSTRAINT IF EXISTS "warehouse_locations_branch_id_location_code_key"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" DROP CONSTRAINT IF EXISTS "inventory_lots_product_id_branch_id_lot_number_key"`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "status" ("id" integer NOT NULL, "name" character varying NOT NULL, CONSTRAINT "PK_e12743a7086ec826733f54e1d95" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_barcodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "product_id" uuid NOT NULL, "barcode" character varying(50) NOT NULL, "barcode_type" character varying(30) NOT NULL DEFAULT 'ean13', "is_primary" boolean NOT NULL DEFAULT false, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_459d7d53aebb732e6c8460247d6" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_product_barcodes_product" ON "product_barcodes" ("product_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_product_barcodes_barcode" ON "product_barcodes" ("barcode") `,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_transfers" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transfer_number" character varying(30) NOT NULL, "from_branch_id" uuid NOT NULL, "to_branch_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'draft', "transfer_date" date NOT NULL DEFAULT ('now'::text)::date, "notes" text, "created_by" uuid NOT NULL, "sent_by" uuid, "sent_at" TIMESTAMP WITH TIME ZONE, "received_by" uuid, "received_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bac22c20473494612c31ce4df7b" UNIQUE ("transfer_number"), CONSTRAINT "PK_0ab69c36e4239d5db7a3e149c31" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_transfer_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "transfer_id" uuid NOT NULL, "product_id" uuid NOT NULL, "lot_id" uuid NOT NULL, "quantity_sent" numeric(12,3) NOT NULL, "quantity_received" numeric(12,3), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_8cf9ce76bf3aed131bba856e717" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_counts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "branch_id" uuid NOT NULL, "count_number" character varying(30) NOT NULL, "count_type" character varying(20) NOT NULL DEFAULT 'full', "status" character varying(20) NOT NULL DEFAULT 'draft', "count_date" date NOT NULL DEFAULT ('now'::text)::date, "notes" text, "created_by" uuid NOT NULL, "approved_by" uuid, "approved_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_4b6745cce257838b087759600ed" UNIQUE ("count_number"), CONSTRAINT "PK_8230343330002d07a2efb485680" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "inventory_count_items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "count_id" uuid NOT NULL, "product_id" uuid NOT NULL, "lot_id" uuid, "system_quantity" numeric(12,3) NOT NULL, "counted_quantity" numeric(12,3), "difference" numeric(12,3), "counted_by" uuid, "counted_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_e1e695e1a140cdc8b94542d4956" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "file" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "path" character varying NOT NULL, CONSTRAINT "PK_36b46d232307066b3a2c9ea3a1d" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "inventory_blocked" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "purchase_order_items" ALTER COLUMN "discount_pct" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "order_date" SET DEFAULT ('now'::text)::date`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "generated_by" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" ALTER COLUMN "lot_id" SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" ALTER COLUMN "receipt_date" SET DEFAULT ('now'::text)::date`);
    await queryRunner.query(`ALTER TABLE "supplier_products" ALTER COLUMN "discount_pct" SET NOT NULL`);
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" ALTER COLUMN "return_date" SET DEFAULT ('now'::text)::date`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" ALTER COLUMN "entry_date" SET DEFAULT ('now'::text)::date`,
    );
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_fe0bb3f6520ee0469504521e71" ON "users" ("username") `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_97672ac88f789774dd47f7c8be" ON "users" ("email") `);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_rif_key" ON "suppliers" ("rif") `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_products_blocked" ON "products" ("inventory_blocked") WHERE inventory_blocked = TRUE`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_e9658e959c490b0a634dfc5478" ON "user_sessions" ("user_id") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "warehouse_locations_branch_id_location_code_key" ON "warehouse_locations" ("branch_id", "location_code") `,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "inventory_lots_product_id_branch_id_lot_number_key" ON "inventory_lots" ("branch_id", "lot_number", "product_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "UQ_bb18600cc0829bc122f097b4f09" UNIQUE ("supplier_id", "product_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "FK_c133e834562c02eb4061813938f" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "FK_fb46f28f13fb590b0d8470d32d7" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_barcodes" ADD CONSTRAINT "FK_08e75dc13a9057314738f004496" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" ADD CONSTRAINT "FK_c1a948461db497d3244a51f2150" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" ADD CONSTRAINT "FK_5200843f9ac6d8780193858459c" FOREIGN KEY ("substitute_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "FK_2d0fea27ab92c2b382058f1e32c" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "FK_bd9345f2a274d6afca37cecbf9d" FOREIGN KEY ("active_ingredient_id") REFERENCES "active_ingredients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_9a5f6868c96e0069e699f33e124" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "FK_1530a6f15d3c79d1b70be98f2be" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "FK_4286173e1486a5c528f89dc798c" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "FK_9ff2b133160a708a047cbce49d2" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfer_items" ADD CONSTRAINT "FK_878740924c2e0d506c1f00683d6" FOREIGN KEY ("transfer_id") REFERENCES "inventory_transfers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" ADD CONSTRAINT "FK_5bfb22f5417882f573d823cb261" FOREIGN KEY ("count_id") REFERENCES "inventory_counts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" ADD CONSTRAINT "FK_16c387fae134e3bd00cec6220a5" FOREIGN KEY ("return_id") REFERENCES "consignment_returns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" ADD CONSTRAINT "FK_293d6320851bea6c29a001d4bc1" FOREIGN KEY ("liquidation_id") REFERENCES "consignment_liquidations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" ADD CONSTRAINT "FK_f236d2f410fd0d9a1c178e1d139" FOREIGN KEY ("consignment_entry_id") REFERENCES "consignment_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" DROP CONSTRAINT IF EXISTS "FK_f236d2f410fd0d9a1c178e1d139"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" DROP CONSTRAINT IF EXISTS "FK_293d6320851bea6c29a001d4bc1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" DROP CONSTRAINT IF EXISTS "FK_16c387fae134e3bd00cec6220a5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_count_items" DROP CONSTRAINT IF EXISTS "FK_5bfb22f5417882f573d823cb261"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_transfer_items" DROP CONSTRAINT IF EXISTS "FK_878740924c2e0d506c1f00683d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "FK_17022daf3f885f7d35423e9971e"`,
    );
    await queryRunner.query(`ALTER TABLE "user_sessions" DROP CONSTRAINT IF EXISTS "FK_e9658e959c490b0a634dfc54783"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "FK_9ff2b133160a708a047cbce49d2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "FK_4286173e1486a5c528f89dc798c"`,
    );
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_1530a6f15d3c79d1b70be98f2be"`);
    await queryRunner.query(`ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "FK_9a5f6868c96e0069e699f33e124"`);
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" DROP CONSTRAINT IF EXISTS "FK_bd9345f2a274d6afca37cecbf9d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" DROP CONSTRAINT IF EXISTS "FK_2d0fea27ab92c2b382058f1e32c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" DROP CONSTRAINT IF EXISTS "FK_5200843f9ac6d8780193858459c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" DROP CONSTRAINT IF EXISTS "FK_c1a948461db497d3244a51f2150"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_barcodes" DROP CONSTRAINT IF EXISTS "FK_08e75dc13a9057314738f004496"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" DROP CONSTRAINT IF EXISTS "FK_fb46f28f13fb590b0d8470d32d7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" DROP CONSTRAINT IF EXISTS "FK_c133e834562c02eb4061813938f"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "FK_a2cecd1a3531c0b041e29ba46e1"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_products" DROP CONSTRAINT IF EXISTS "UQ_bb18600cc0829bc122f097b4f09"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."inventory_lots_product_id_branch_id_lot_number_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."warehouse_locations_branch_id_location_code_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_e9658e959c490b0a634dfc5478"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_products_blocked"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."suppliers_rif_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_97672ac88f789774dd47f7c8be"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_fe0bb3f6520ee0469504521e71"`);
    await queryRunner.query(`ALTER TABLE "consignment_entries" ALTER COLUMN "entry_date" SET DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "consignment_returns" ALTER COLUMN "return_date" SET DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "supplier_products" ALTER COLUMN "discount_pct" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "goods_receipts" ALTER COLUMN "receipt_date" SET DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "goods_receipt_items" ALTER COLUMN "lot_id" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "generated_by" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "purchase_orders" ALTER COLUMN "order_date" SET DEFAULT CURRENT_DATE`);
    await queryRunner.query(`ALTER TABLE "purchase_order_items" ALTER COLUMN "discount_pct" DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN "inventory_blocked"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "file"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_count_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_counts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_transfer_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_transfers"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_product_barcodes_barcode"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "public"."idx_product_barcodes_product"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "product_barcodes"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "status"`);
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_branch_id_lot_number_key" UNIQUE ("product_id", "branch_id", "lot_number")`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_branch_id_location_code_key" UNIQUE ("branch_id", "location_code")`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_product_id_key" UNIQUE ("supplier_id", "product_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_check" CHECK ((product_id <> substitute_id))`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_inventory_lots_product" ON "inventory_lots" ("branch_id", "product_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "global_config" ADD CONSTRAINT "global_config_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" ADD CONSTRAINT "consignment_entries_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" ADD CONSTRAINT "consignment_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entries" ADD CONSTRAINT "consignment_entries_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" ADD CONSTRAINT "consignment_entry_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" ADD CONSTRAINT "consignment_entry_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_entry_items" ADD CONSTRAINT "consignment_entry_items_consignment_entry_id_fkey" FOREIGN KEY ("consignment_entry_id") REFERENCES "consignment_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" ADD CONSTRAINT "consignment_liquidation_items_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "consignment_entry_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidation_items" ADD CONSTRAINT "consignment_liquidation_items_liquidation_id_fkey" FOREIGN KEY ("liquidation_id") REFERENCES "consignment_liquidations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" ADD CONSTRAINT "consignment_liquidations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" ADD CONSTRAINT "consignment_liquidations_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" ADD CONSTRAINT "consignment_liquidations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_liquidations" ADD CONSTRAINT "consignment_liquidations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" ADD CONSTRAINT "consignment_returns_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" ADD CONSTRAINT "consignment_returns_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" ADD CONSTRAINT "consignment_returns_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_returns" ADD CONSTRAINT "consignment_returns_consignment_entry_id_fkey" FOREIGN KEY ("consignment_entry_id") REFERENCES "consignment_entries"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" ADD CONSTRAINT "consignment_return_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" ADD CONSTRAINT "consignment_return_items_consignment_item_id_fkey" FOREIGN KEY ("consignment_item_id") REFERENCES "consignment_entry_items"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "consignment_return_items" ADD CONSTRAINT "consignment_return_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "consignment_returns"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "warehouse_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_lots" ADD CONSTRAINT "inventory_lots_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kardex" ADD CONSTRAINT "kardex_terminal_id_fkey" FOREIGN KEY ("terminal_id") REFERENCES "terminals"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kardex" ADD CONSTRAINT "kardex_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kardex" ADD CONSTRAINT "kardex_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kardex" ADD CONSTRAINT "kardex_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "kardex" ADD CONSTRAINT "kardex_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "warehouse_locations" ADD CONSTRAINT "warehouse_locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_fkey" FOREIGN KEY ("brand_id") REFERENCES "brands"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_active_ingredient_id_fkey" FOREIGN KEY ("active_ingredient_id") REFERENCES "active_ingredients"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_active_ingredients" ADD CONSTRAINT "product_active_ingredients_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_substitute_id_fkey" FOREIGN KEY ("substitute_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_substitutes" ADD CONSTRAINT "product_substitutes_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_received_by_fkey" FOREIGN KEY ("received_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "inventory_lots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "goods_receipts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "purchase_orders"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "terminals" ADD CONSTRAINT "terminals_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }
}
