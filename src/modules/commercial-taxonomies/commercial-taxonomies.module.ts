import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TerminalsModule } from '@/modules/terminals/terminals.module';
import { CommercialTaxonomiesService } from './commercial-taxonomies.service';
import { CommercialTaxonomiesController } from './commercial-taxonomies.controller';
import { CommercialLineEntity } from './infrastructure/persistence/relational/entities/commercial-line.entity';
import { CommercialVariantEntity } from './infrastructure/persistence/relational/entities/commercial-variant.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CommercialLineEntity, CommercialVariantEntity]), TerminalsModule],
  controllers: [CommercialTaxonomiesController],
  providers: [CommercialTaxonomiesService],
  exports: [CommercialTaxonomiesService],
})
export class CommercialTaxonomiesModule {}
