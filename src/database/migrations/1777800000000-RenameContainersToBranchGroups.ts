import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Rename completo del concepto "Contenedor"/"Cluster" a "Grupo de sucursales"
 * (entidad `BranchGroup`, tabla `branch_groups`). Es un nombre más natural en
 * español y evita ambigüedad con Docker/contenedores físicos.
 *
 * Renombramos:
 *   - `containers`                              → `branch_groups`
 *   - `container_amount_approval_rules`         → `branch_group_amount_approval_rules`
 *   - `container_category_approval_rules`       → `branch_group_category_approval_rules`
 *   - `branches.container_id`                   → `branches.branch_group_id`
 *   - índices y constraints asociados
 *
 * Postgres `ALTER TABLE ... RENAME` es DDL atómico y barato (no copia datos),
 * así que el rename es seguro incluso con datos existentes.
 */
export class RenameContainersToBranchGroups1777800000000 implements MigrationInterface {
  name = 'RenameContainersToBranchGroups1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── Tablas ────────────────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE containers RENAME TO branch_groups`);
    await queryRunner.query(`ALTER TABLE container_amount_approval_rules RENAME TO branch_group_amount_approval_rules`);
    await queryRunner.query(
      `ALTER TABLE container_category_approval_rules RENAME TO branch_group_category_approval_rules`,
    );

    // ─── Columnas FK ───────────────────────────────────────────────────────
    await queryRunner.query(`ALTER TABLE branches RENAME COLUMN container_id TO branch_group_id`);
    await queryRunner.query(
      `ALTER TABLE branch_group_amount_approval_rules RENAME COLUMN container_id TO branch_group_id`,
    );
    await queryRunner.query(
      `ALTER TABLE branch_group_category_approval_rules RENAME COLUMN container_id TO branch_group_id`,
    );

    // ─── Índices ───────────────────────────────────────────────────────────
    await queryRunner.query(`ALTER INDEX idx_branches_container_id RENAME TO idx_branches_branch_group_id`);
    await queryRunner.query(`ALTER INDEX idx_amount_rules_container_id RENAME TO idx_amount_rules_branch_group_id`);
    await queryRunner.query(`ALTER INDEX idx_category_rules_container_id RENAME TO idx_category_rules_branch_group_id`);

    // ─── Constraints ───────────────────────────────────────────────────────
    // El UNIQUE compuesto en category rules se llamaba uq_container_category;
    // lo renombramos para mantener consistencia con el nuevo nombre.
    await queryRunner.query(`
      ALTER TABLE branch_group_category_approval_rules
        RENAME CONSTRAINT uq_container_category TO uq_branch_group_category
    `);

    // ─── Seed string final ─────────────────────────────────────────────────
    await queryRunner.query(`
      UPDATE branch_groups
         SET description = 'Grupo por defecto. Asigna sucursales a grupos específicos para activar la matriz de aprobación.'
       WHERE name = 'Sin asignar'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertimos en orden inverso. Cada paso es el espejo exacto del up.
    await queryRunner.query(`
      UPDATE branch_groups
         SET description = 'Cluster por defecto. Asigna sucursales a clusters específicos para activar la matriz de aprobación.'
       WHERE name = 'Sin asignar'
    `);

    await queryRunner.query(`
      ALTER TABLE branch_group_category_approval_rules
        RENAME CONSTRAINT uq_branch_group_category TO uq_container_category
    `);

    await queryRunner.query(`ALTER INDEX idx_category_rules_branch_group_id RENAME TO idx_category_rules_container_id`);
    await queryRunner.query(`ALTER INDEX idx_amount_rules_branch_group_id RENAME TO idx_amount_rules_container_id`);
    await queryRunner.query(`ALTER INDEX idx_branches_branch_group_id RENAME TO idx_branches_container_id`);

    await queryRunner.query(
      `ALTER TABLE branch_group_category_approval_rules RENAME COLUMN branch_group_id TO container_id`,
    );
    await queryRunner.query(
      `ALTER TABLE branch_group_amount_approval_rules RENAME COLUMN branch_group_id TO container_id`,
    );
    await queryRunner.query(`ALTER TABLE branches RENAME COLUMN branch_group_id TO container_id`);

    await queryRunner.query(
      `ALTER TABLE branch_group_category_approval_rules RENAME TO container_category_approval_rules`,
    );
    await queryRunner.query(`ALTER TABLE branch_group_amount_approval_rules RENAME TO container_amount_approval_rules`);
    await queryRunner.query(`ALTER TABLE branch_groups RENAME TO containers`);
  }
}
