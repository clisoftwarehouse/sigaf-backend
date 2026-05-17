import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Agrega tres campos opcionales al maestro de productos para soportar el
 * layout de creación unificado (Genérico / Comercial / Masivo):
 *
 *   - dosage_form: forma farmacéutica (Tabletas, Cápsulas, Suspensión, Jarabe…)
 *     Aplica solo a medicamentos; queda NULL para productos masivos.
 *   - commercial_line: línea/sub-marca para productos de consumo masivo
 *     (ej. "Total 12 Clean Mint" dentro de Colgate). NULL para medicamentos.
 *   - commercial_variant: variante específica del producto masivo
 *     (ej. "Crema dental", "Shampoo"). NULL para medicamentos.
 *
 * Todas las columnas son nullable y no tienen default, por lo que los
 * productos existentes siguen funcionando sin modificación.
 */
export class AddCommercialFieldsToProducts1778900000000 implements MigrationInterface {
  name = 'AddCommercialFieldsToProducts1778900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "dosage_form" varchar(30) NULL`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "commercial_line" varchar(100) NULL`);
    await queryRunner.query(`ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "commercial_variant" varchar(100) NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercial_variant"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "commercial_line"`);
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "dosage_form"`);
  }
}
