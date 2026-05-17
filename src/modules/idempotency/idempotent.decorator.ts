import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_METADATA_KEY = 'is_idempotent';

/**
 * Marca un handler como idempotente. El IdempotencyInterceptor sólo procesa
 * requests con esta metadata; los demás endpoints pasan sin overhead.
 *
 * Requiere header `Idempotency-Key: <uuid>` en la request.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_METADATA_KEY, true);
