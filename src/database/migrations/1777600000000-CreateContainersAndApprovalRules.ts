import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Fase B - Política de OCs SIGAF.
 *
 * Introduce el concepto de "Contenedor" como agrupación lógica de sucursales
 * con su propia matriz de aprobación de OCs (PDF Política OC, Sección 1+2):
 *
 *  - `containers`: catálogo de agrupaciones (ej. "Caracas premium", "Pequeñas").
 *  - `branches.container_id`: cada sucursal pertenece a un contenedor.
 *  - `container_amount_approval_rules`: por contenedor, un rango USD por rol
 *    (ej. en Contenedor A, el Gerente aprueba $0–$2.000, Supervisor $2.001–$10.000).
 *  - `container_category_approval_rules`: aprobador especial para categorías
 *    sensibles (controlled, antibiotic, cold_chain, imported), independiente del monto.
 *  - `products.is_imported`: flag para que el motor de aprobación pueda
 *    detectar productos importados.
 *
 * Backfill: se crea un contenedor "Sin asignar" y todas las sucursales existentes
 * se asignan ahí. Mientras un contenedor no tenga reglas configuradas, el motor
 * de aprobación cae al comportamiento legacy (cualquier user con permiso aprueba).
 */
export class CreateContainersAndApprovalRules1777600000000 implements MigrationInterface {
  name = 'CreateContainersAndApprovalRules1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ─── containers ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS containers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // ─── branches.container_id ─────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE branches
        ADD COLUMN IF NOT EXISTS container_id UUID NULL
        REFERENCES containers(id) ON DELETE SET NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_branches_container_id ON branches(container_id)
    `);

    // ─── Container default + asignación de branches existentes ─────────────
    await queryRunner.query(`
      INSERT INTO containers (name, description)
      VALUES (
        'Sin asignar',
        'Cluster por defecto. Asigna sucursales a clusters específicos para activar la matriz de aprobación.'
      )
      ON CONFLICT (name) DO NOTHING
    `);
    await queryRunner.query(`
      UPDATE branches
         SET container_id = (SELECT id FROM containers WHERE name = 'Sin asignar')
       WHERE container_id IS NULL
    `);

    // ─── container_amount_approval_rules ───────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS container_amount_approval_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        min_usd DECIMAL(18,4) NOT NULL DEFAULT 0,
        max_usd DECIMAL(18,4),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_amount_range CHECK (max_usd IS NULL OR max_usd > min_usd),
        CONSTRAINT chk_min_nonneg CHECK (min_usd >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_amount_rules_container_id
        ON container_amount_approval_rules(container_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_amount_rules_role_id
        ON container_amount_approval_rules(role_id)
    `);

    // ─── container_category_approval_rules ─────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS container_category_approval_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        container_id UUID NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
        category_flag VARCHAR(20) NOT NULL,
        role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT chk_category_flag CHECK (
          category_flag IN ('controlled', 'antibiotic', 'cold_chain', 'imported')
        ),
        CONSTRAINT uq_container_category UNIQUE (container_id, category_flag)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_category_rules_container_id
        ON container_category_approval_rules(container_id)
    `);

    // ─── products.is_imported ──────────────────────────────────────────────
    await queryRunner.query(`
      ALTER TABLE products
        ADD COLUMN IF NOT EXISTS is_imported BOOLEAN NOT NULL DEFAULT FALSE
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_products_imported
        ON products(is_imported) WHERE is_imported = TRUE
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_products_imported`);
    await queryRunner.query(`ALTER TABLE products DROP COLUMN IF EXISTS is_imported`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_category_rules_container_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS container_category_approval_rules`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_amount_rules_role_id`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_amount_rules_container_id`);
    await queryRunner.query(`DROP TABLE IF EXISTS container_amount_approval_rules`);

    await queryRunner.query(`DROP INDEX IF EXISTS idx_branches_container_id`);
    await queryRunner.query(`ALTER TABLE branches DROP COLUMN IF EXISTS container_id`);

    await queryRunner.query(`DROP TABLE IF EXISTS containers`);
  }
}
