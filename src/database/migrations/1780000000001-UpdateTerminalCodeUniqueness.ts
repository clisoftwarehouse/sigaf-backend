import { QueryRunner, MigrationInterface } from 'typeorm';

export class UpdateTerminalCodeUniqueness1780000000001 implements MigrationInterface {
  name = 'UpdateTerminalCodeUniqueness1780000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      DECLARE
        constraint_name text;
      BEGIN
        FOR constraint_name IN
          SELECT con.conname
          FROM pg_constraint con
          JOIN pg_class rel ON rel.oid = con.conrelid
          JOIN pg_namespace nsp ON nsp.oid = con.connamespace
          WHERE nsp.nspname = current_schema()
            AND rel.relname = 'terminals'
            AND con.contype = 'u'
            AND array_length(con.conkey, 1) = 1
            AND con.conkey[1] = (
              SELECT attnum
              FROM pg_attribute
              WHERE attrelid = rel.oid
                AND attname = 'code'
                AND NOT attisdropped
            )
        LOOP
          EXECUTE format('ALTER TABLE "terminals" DROP CONSTRAINT %I', constraint_name);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "terminals" ADD CONSTRAINT "terminals_branch_id_code_key" UNIQUE ("branch_id", "code")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "terminals" DROP CONSTRAINT IF EXISTS "terminals_branch_id_code_key"`);
    await queryRunner.query(`ALTER TABLE "terminals" ADD CONSTRAINT "terminals_code_key" UNIQUE ("code")`);
  }
}
