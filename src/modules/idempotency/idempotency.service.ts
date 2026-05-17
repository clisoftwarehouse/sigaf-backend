import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, ConflictException } from '@nestjs/common';

import { IdempotencyKeyEntity } from './infrastructure/persistence/relational/entities/idempotency-key.entity';

const DEFAULT_TTL_HOURS = 72;
const LOCK_DURATION_SECONDS = 60;

export interface CachedResponse {
  statusCode: number;
  body: unknown;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectRepository(IdempotencyKeyEntity)
    private readonly repo: Repository<IdempotencyKeyEntity>,
  ) {}

  hashRequest(payload: unknown): string {
    const stable = JSON.stringify(payload ?? null);
    return createHash('sha256').update(stable).digest('hex');
  }

  /**
   * Reserva la key para procesamiento. Casos:
   *  - No existe: inserta con `lockedUntil` ahora+60s y devuelve `null`
   *    (el caller procesa y luego llama `store()`).
   *  - Existe con response → devuelve cache.
   *  - Existe con lock vivo → 409 (request concurrente, reintenta más tarde).
   *  - Existe con lock vencido y sin response → reusa, vuelve a lockear.
   *  - Existe pero el `requestHash` difiere → 409 (clave reusada con
   *    payload distinto, error del cliente).
   */
  async reserveOrFetch(args: {
    key: string;
    endpoint: string;
    requestHash: string;
    userId?: string | null;
  }): Promise<CachedResponse | null> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DEFAULT_TTL_HOURS * 3600 * 1000);
    const lockedUntil = new Date(now.getTime() + LOCK_DURATION_SECONDS * 1000);

    const existing = await this.repo.findOne({ where: { key: args.key } });

    if (!existing) {
      const fresh = this.repo.create({
        key: args.key,
        endpoint: args.endpoint,
        requestHash: args.requestHash,
        userId: args.userId ?? null,
        statusCode: null,
        responseBody: null,
        expiresAt,
        lockedUntil,
      });
      await this.repo.save(fresh);
      return null;
    }

    if (existing.requestHash !== args.requestHash) {
      throw new ConflictException('Idempotency-Key reutilizada con un payload distinto al original');
    }

    if (existing.responseBody !== null && existing.statusCode !== null) {
      return { statusCode: existing.statusCode, body: existing.responseBody };
    }

    if (existing.lockedUntil && existing.lockedUntil > now) {
      throw new ConflictException(
        'Otra request con la misma Idempotency-Key está siendo procesada. Reintenta en unos segundos.',
      );
    }

    existing.lockedUntil = lockedUntil;
    existing.endpoint = args.endpoint;
    existing.expiresAt = expiresAt;
    await this.repo.save(existing);
    return null;
  }

  async store(key: string, statusCode: number, body: unknown): Promise<void> {
    await this.repo.update(
      { key },
      {
        statusCode,
        responseBody: body as object,
        lockedUntil: null,
      },
    );
  }

  async release(key: string): Promise<void> {
    await this.repo.update({ key }, { lockedUntil: null });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.repo.createQueryBuilder().delete().where('expires_at < now()').execute();
    return result.affected ?? 0;
  }
}
