import { QueryRunner, MigrationInterface } from 'typeorm';

export class ExtendBrandsAndSupplierContacts1776220204094 implements MigrationInterface {
  name = 'ExtendBrandsAndSupplierContacts1776220204094';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "rif" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "business_name" character varying(200)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "address" text`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "phone" character varying(20)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "email" character varying(150)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "country_of_origin" character varying(100)`);
    await queryRunner.query(
      `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "brand_type" character varying(30) NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_importer" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_manufacturer" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "tax_regime" character varying(50)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "supplier_id" uuid`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "parent_brand_id" uuid`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "website" character varying(255)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "logo_url" character varying(500)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "regulatory_code" character varying(100)`);
    await queryRunner.query(`ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true`);
    await queryRunner.query(
      `ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_brands_rif" ON "brands" ("rif") WHERE "rif" IS NOT NULL`,
    );

    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_brands_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_brands_parent" FOREIGN KEY ("parent_brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE IF NOT EXISTS "supplier_contacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "supplier_id" uuid NOT NULL,
        "full_name" character varying(150) NOT NULL,
        "role" character varying(100),
        "department" character varying(100),
        "email" character varying(150),
        "phone" character varying(20),
        "mobile" character varying(20),
        "is_primary" boolean NOT NULL DEFAULT false,
        "is_active" boolean NOT NULL DEFAULT true,
        "notes" text,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_supplier_contacts" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "supplier_contacts" ADD CONSTRAINT "FK_supplier_contacts_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_supplier_contacts_supplier" ON "supplier_contacts" ("supplier_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_supplier_contacts_supplier"`);
    await queryRunner.query(
      `ALTER TABLE "supplier_contacts" DROP CONSTRAINT IF EXISTS "FK_supplier_contacts_supplier"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "supplier_contacts"`);

    await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "FK_brands_parent"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "FK_brands_supplier"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_brands_rif"`);

    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "updated_at"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "is_active"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "regulatory_code"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "logo_url"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "website"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "parent_brand_id"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "supplier_id"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "tax_regime"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "is_manufacturer"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "is_importer"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "brand_type"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "country_of_origin"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "email"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "phone"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "address"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "business_name"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP COLUMN IF EXISTS "rif"`);
  }
}
