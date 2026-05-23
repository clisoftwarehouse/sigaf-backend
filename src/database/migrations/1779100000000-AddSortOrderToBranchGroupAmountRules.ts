import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Las reglas de aprobación por monto en `branch_group_amount_approval_rules`
 * se reordenaban erráticamente al editar el grupo: el service hace
 * `DELETE + INSERT` masivo en una sola transacción, y todos los
 * `created_at` quedan con el mismo `transaction_timestamp()`. Postgres no
 * garantiza orden entre filas con timestamp idéntico, así que listados
 * sucesivos podían intercambiar reglas (la de 0-10 quedaba en medio aunque
 * fuese la primera creada).
 *
 * Solución: columna `sort_order` explícita que el service llena con el
 * índice del array recibido del frontend, y por la que ordena al leer.
 */
export class AddSortOrderToBranchGroupAmountRules1779100000000 implements MigrationInterface {
  name = 'AddSortOrderToBranchGroupAmountRules1779100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE branch_group_amount_approval_rules
       ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0`,
    );

    // Backfill: por grupo, asignamos sort_order según min_usd ASC para que
    // las reglas existentes queden ordenadas de menor a mayor monto (que es
    // el orden natural y razonable de auditar).
    await queryRunner.query(`
      WITH ordered AS (
        SELECT id, row_number() OVER (PARTITION BY branch_group_id ORDER BY min_usd ASC, created_at ASC) - 1 AS rn
        FROM branch_group_amount_approval_rules
      )
      UPDATE branch_group_amount_approval_rules r
      SET sort_order = o.rn
      FROM ordered o
      WHERE r.id = o.id
    `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS idx_bg_amount_rules_group_sort
       ON branch_group_amount_approval_rules (branch_group_id, sort_order)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_bg_amount_rules_group_sort`);
    await queryRunner.query(`ALTER TABLE branch_group_amount_approval_rules DROP COLUMN IF EXISTS sort_order`);
  }
}
