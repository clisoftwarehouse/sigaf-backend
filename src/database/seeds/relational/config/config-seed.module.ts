import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigSeedService } from './config-seed.service';
import { GlobalConfigEntity } from '@/modules/config-global/infrastructure/persistence/relational/entities/global-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalConfigEntity])],
  providers: [ConfigSeedService],
  exports: [ConfigSeedService],
})
export class ConfigSeedModule {}
