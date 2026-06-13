import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentEmissionService } from './document-emission.service';
import { SaleDocumentEntity } from './infrastructure/persistence/relational/entities/sale-document.entity';
import { DocumentEmissionMethodEntity } from './infrastructure/persistence/relational/entities/document-emission-method.entity';

/**
 * Módulo standalone de persistencia de emisión (config por terminal + registro
 * de documentos). NO depende de los plugins — así no hay ciclo. Los controllers
 * (que cruzan config con plugins descubiertos) viven en EmissionPluginsModule.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentEmissionMethodEntity, SaleDocumentEntity])],
  providers: [DocumentEmissionService],
  exports: [DocumentEmissionService],
})
export class DocumentEmissionModule {}
