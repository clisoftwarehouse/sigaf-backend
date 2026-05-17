import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { CashSessionsService } from './cash-sessions.service';
import { CashSessionsController } from './cash-sessions.controller';
import { CashSessionEntity } from './infrastructure/persistence/relational/entities/cash-session.entity';
import { CashMovementEntity } from './infrastructure/persistence/relational/entities/cash-movement.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';

@Module({
  imports: [TypeOrmModule.forFeature([CashSessionEntity, CashMovementEntity, TerminalEntity])],
  controllers: [CashSessionsController],
  providers: [CashSessionsService],
  exports: [CashSessionsService],
})
export class CashSessionsModule {}
