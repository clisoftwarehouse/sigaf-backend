import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Agrega `tracks_expiration` a `products`. Productos con `false` (jabón,
 * peines, papel, etc.) no exigen `expiration_date` en la recepción y sus
 * lotes se crean con vencimiento NULL.
 *
 * Default `true` para que productos legacy (medicamentos en mayoría) sigan
 * exigiendo vencimiento sin necesidad de backfill.
 */
export class AddTracksExpirationToProducts1779400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "products"
         ADD COLUMN IF NOT EXISTS "tracks_expiration" BOOLEAN NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "products" DROP COLUMN IF EXISTS "tracks_expiration"`);
  }
}
