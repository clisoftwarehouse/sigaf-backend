import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { IdempotencyKeyEntity } from './infrastructure/persistence/relational/entities/idempotency-key.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([IdempotencyKeyEntity])],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule {}
