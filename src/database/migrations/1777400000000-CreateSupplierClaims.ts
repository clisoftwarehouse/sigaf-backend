import { QueryRunner, MigrationInterface } from 'typeorm';

export class CreateSupplierClaims1777400000000 implements MigrationInterface {
  name = 'CreateSupplierClaims1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE supplier_claims (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        claim_number VARCHAR(30) NOT NULL UNIQUE,
        supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
        receipt_id UUID NULL REFERENCES goods_receipts(id) ON DELETE SET NULL,
        branch_id UUID NULL REFERENCES branches(id) ON DELETE SET NULL,
        claim_type VARCHAR(20) NOT NULL CHECK (claim_type IN ('quality','quantity','price_mismatch','other')),
        status VARCHAR(15) NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','rejected')),
        title VARCHAR(120) NOT NULL,
        description TEXT NOT NULL,
        amount_usd NUMERIC(18, 4) NULL,
        resolution_notes TEXT NULL,
        created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        resolved_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ NULL
      )
    `);

    await queryRunner.query(`
      CREATE INDEX idx_supplier_claims_supplier_id ON supplier_claims (supplier_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_supplier_claims_receipt_id ON supplier_claims (receipt_id)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_supplier_claims_status ON supplier_claims (status)
    `);
    await queryRunner.query(`
      CREATE INDEX idx_supplier_claims_created_at ON supplier_claims (created_at DESC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS supplier_claims`);
  }
}
