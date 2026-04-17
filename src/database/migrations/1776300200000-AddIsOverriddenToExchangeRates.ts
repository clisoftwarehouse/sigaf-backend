import { QueryRunner, MigrationInterface } from 'typeorm';

export class AddIsOverriddenToExchangeRates1776300200000 implements MigrationInterface {
  name = 'AddIsOverriddenToExchangeRates1776300200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "is_overridden" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exchange_rates" DROP COLUMN IF EXISTS "is_overridden"`);
  }
}
