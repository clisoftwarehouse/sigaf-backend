import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Simplifica la tabla `brands` eliminando campos no esenciales.
 * Se conservan: id, name, is_laboratory, is_active, created_at, updated_at.
 *
 * Se eliminan: rif, business_name, address, phone, email, country_of_origin,
 * brand_type, is_importer, is_manufacturer, tax_regime, supplier_id,
 * parent_brand_id, website, logo_url, regulatory_code.
 */
export class SimplifyBrands1776300100000 implements MigrationInterface {
  name = 'SimplifyBrands1776300100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Eliminar constraints y índices antes de las columnas
    await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "FK_brands_parent"`);
    await queryRunner.query(`ALTER TABLE "brands" DROP CONSTRAINT IF EXISTS "FK_brands_supplier"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_brands_rif"`);

    // Eliminar columnas extendidas
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

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Re-agregar columnas (idéntico a ExtendBrandsAndSupplierContacts.up)
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

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_brands_rif" ON "brands" ("rif") WHERE "rif" IS NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_brands_supplier" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "brands" ADD CONSTRAINT "FK_brands_parent" FOREIGN KEY ("parent_brand_id") REFERENCES "brands"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
