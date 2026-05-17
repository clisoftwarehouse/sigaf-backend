import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TerminalsService } from './terminals.service';
import { TerminalsController } from './terminals.controller';
import { TerminalPairingService } from './terminal-pairing.service';
import { TerminalEntity } from './infrastructure/persistence/relational/entities/terminal.entity';
import { TerminalApiKeyEntity } from './infrastructure/persistence/relational/entities/terminal-api-key.entity';
import { TerminalPairingCodeEntity } from './infrastructure/persistence/relational/entities/terminal-pairing-code.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TerminalEntity, TerminalApiKeyEntity, TerminalPairingCodeEntity])],
  controllers: [TerminalsController],
  providers: [TerminalsService, TerminalPairingService],
  exports: [TerminalsService, TerminalPairingService],
})
export class TerminalsModule {}
