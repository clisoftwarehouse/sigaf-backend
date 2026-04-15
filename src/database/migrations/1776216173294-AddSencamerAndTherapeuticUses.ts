import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddSencamerAndTherapeuticUses1776216173294 implements MigrationInterface {
  name = 'AddSencamerAndTherapeuticUses1776216173294';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "sencamer_registration" character varying(50)`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "therapeutic_uses" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "name" character varying(200) NOT NULL,
        "description" character varying(500),
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_therapeutic_uses_name" UNIQUE ("name"),
        CONSTRAINT "PK_therapeutic_uses" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "product_therapeutic_uses" (
        "product_id" uuid NOT NULL,
        "therapeutic_use_id" uuid NOT NULL,
        CONSTRAINT "PK_product_therapeutic_uses" PRIMARY KEY ("product_id", "therapeutic_use_id")
      )`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses"
        ADD CONSTRAINT "FK_product_therapeutic_uses_product"
        FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses"
        ADD CONSTRAINT "FK_product_therapeutic_uses_therapeutic_use"
        FOREIGN KEY ("therapeutic_use_id") REFERENCES "therapeutic_uses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_therapeutic_uses_product" ON "product_therapeutic_uses" ("product_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_product_therapeutic_uses_therapeutic_use" ON "product_therapeutic_uses" ("therapeutic_use_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_therapeutic_uses_therapeutic_use"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_product_therapeutic_uses_product"`);
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses" DROP CONSTRAINT IF EXISTS "FK_product_therapeutic_uses_therapeutic_use"`,
    );
    await queryRunner.query(
      `ALTER TABLE "product_therapeutic_uses" DROP CONSTRAINT IF EXISTS "FK_product_therapeutic_uses_product"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "product_therapeutic_uses"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "therapeutic_uses"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "sencamer_registration"`);
  }
}
