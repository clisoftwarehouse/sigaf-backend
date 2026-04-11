import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ConfigGlobalService } from './config-global.service';
import { ConfigGlobalController } from './config-global.controller';
import { GlobalConfigEntity } from './infrastructure/persistence/relational/entities/global-config.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GlobalConfigEntity])],
  controllers: [ConfigGlobalController],
  providers: [ConfigGlobalService],
  exports: [ConfigGlobalService],
})
export class ConfigGlobalModule {}
