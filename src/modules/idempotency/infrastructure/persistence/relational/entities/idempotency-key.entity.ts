import { Index, Column, Entity, PrimaryColumn, CreateDateColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Soporte para idempotencia HTTP en POSTs transaccionales (ej. POST /sales/tickets).
 *
 * Cliente envía header `Idempotency-Key: <uuid>`. La primera vez que llegue una
 * combinación (key, endpoint, requestHash) se procesa el handler y se persiste
 * la respuesta. Si llega de nuevo dentro del TTL, se devuelve el response
 * cacheado sin re-ejecutar el handler — eliminando duplicados por reintentos
 * (sync de POS offline, retries de red, double-click, etc.).
 *
 * `lockedUntil` se setea al iniciar el procesamiento para detectar requests
 * concurrentes con la misma key (segunda llamada antes de que termine la
 * primera): se rechaza con 409 hasta que expire o termine.
 */
@Entity('idempotency_keys')
@Index('idx_idempotency_keys_expires', ['expiresAt'])
export class IdempotencyKeyEntity extends EntityRelationalHelper {
  @PrimaryColumn('varchar', { length: 100 })
  key: string;

  @Column('varchar', { length: 200 })
  endpoint: string;

  @Column('varchar', { name: 'request_hash', length: 64 })
  requestHash: string;

  @Column('int', { name: 'status_code', nullable: true })
  statusCode: number | null;

  @Column('jsonb', { name: 'response_body', nullable: true })
  responseBody: unknown | null;

  @Column('uuid', { name: 'user_id', nullable: true })
  userId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @Column('timestamptz', { name: 'locked_until', nullable: true })
  lockedUntil: Date | null;
}
