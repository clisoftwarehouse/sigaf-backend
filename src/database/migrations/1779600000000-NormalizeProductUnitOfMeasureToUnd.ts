import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Normaliza `products.unit_of_measure` a `UND` para todos los productos.
 *
 * Contexto: el form derivaba `unitOfMeasure` desde el `packagingUnit` (la
 * unidad del contenido del empaque). Resultado: productos como Voltaren tubo
 * de 50G terminaban con stock en "G" en lugar de "UND", lo cual confundía
 * conteos, ventas y recepciones.
 *
 * La regla de negocio correcta: el stock SIEMPRE se cuenta en unidades
 * (cajas, tubos, blisters). La cantidad de contenido por unidad (50G, 100ML,
 * etc.) vive en `presentation` y es informativa, no transaccional.
 *
 * Esta migration es destructiva (overwrite) pero idempotente. Si en el
 * futuro se quiere soportar pesables reales (granel), se haría con un nuevo
 * flag separado, no reciclando este campo.
 */
export class NormalizeProductUnitOfMeasureToUnd1779600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE "products" SET "unit_of_measure" = 'UND' WHERE "unit_of_measure" <> 'UND'`);
  }

  public async down(): Promise<void> {
    // No rollback — perderíamos información si revertimos sin auditar el
    // packaging_unit original de cada producto. Si se necesita, restaurar
    // manualmente desde backup.
  }
}
