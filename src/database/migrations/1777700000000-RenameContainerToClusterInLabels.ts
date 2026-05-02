import { QueryRunner, MigrationInterface } from 'typeorm';

/**
 * Cambio cosmético intermedio (descartado): renombró el seed "Sin asignar"
 * de "Contenedor por defecto..." a "Cluster por defecto...". La siguiente
 * migración (1777800000000) hace un rename completo a "Grupo de sucursales"
 * y actualiza este string nuevamente.
 *
 * Esta migración se mantiene para preservar el historial — ya fue ejecutada
 * en BDs existentes y eliminarla rompería `migration:revert`.
 */
export class RenameContainerToClusterInLabels1777700000000 implements MigrationInterface {
  name = 'RenameContainerToClusterInLabels1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE containers
         SET description = 'Cluster por defecto. Asigna sucursales a clusters específicos para activar la matriz de aprobación.'
       WHERE name = 'Sin asignar'
         AND description LIKE 'Contenedor por defecto%'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE containers
         SET description = 'Contenedor por defecto. Asigna sucursales a contenedores específicos para activar la matriz de aprobación.'
       WHERE name = 'Sin asignar'
         AND description LIKE 'Cluster por defecto%'
    `);
  }
}
