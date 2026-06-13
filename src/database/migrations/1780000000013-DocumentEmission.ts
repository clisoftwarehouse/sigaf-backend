import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Arquitectura de emisión de documentos plug-in.
 *
 * Ver docs/architecture/emission-plugin-architecture.md (10 reglas inviolables).
 *
 *  - document_emission_methods: qué métodos de emisión están activos por
 *    terminal (HKA fiscal, nota de entrega, recibo provisional, …). method_key
 *    es string (no enum) para que agregar/quitar plugins NO requiera migración.
 *  - sale_documents: 1 row por documento efectivamente emitido. La AUSENCIA de
 *    row significa "no se emitió documento" — sin distinguir el motivo. NUNCA
 *    se agregan columnas is_fiscal/fiscal_status/requires_invoice a sale_tickets.
 *
 * Ambas tablas son aditivas: no tocan el core de ventas.
 */
export class DocumentEmission1780000000013 implements MigrationInterface {
  name = 'DocumentEmission1780000000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "document_emission_methods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "terminal_id" uuid NOT NULL REFERENCES "terminals"("id"),
        "method_key" varchar(50) NOT NULL,
        "config_json" jsonb NOT NULL DEFAULT '{}',
        "priority" integer NOT NULL DEFAULT 100,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "ux_dem_terminal_method" UNIQUE ("terminal_id", "method_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_dem_active" ON "document_emission_methods" ("terminal_id") WHERE "is_active" = true`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "sale_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "sale_ticket_id" uuid NOT NULL REFERENCES "sale_tickets"("id"),
        "document_type" varchar(50) NOT NULL,
        "document_number" varchar(50),
        "control_number" varchar(50),
        "emission_method_id" uuid REFERENCES "document_emission_methods"("id"),
        "raw_response_json" jsonb,
        "status" varchar(20) NOT NULL DEFAULT 'emitted',
        "failure_reason" text,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_sd_ticket" ON "sale_documents" ("sale_ticket_id")`);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sd_type" ON "sale_documents" ("document_type", "created_at")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "sale_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_emission_methods"`);
  }
}
