import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { TerminalEntity } from './terminal.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

/**
 * apiKey por terminal (long-lived). Almacenamos sólo el hash bcrypt; el
 * valor original se entrega una sola vez al consumir el pairing code y debe
 * persistirse en almacenamiento seguro del PC (Stronghold cuando entre).
 *
 * `keyPrefix` (primeros 12 chars del valor original) se guarda en claro para
 * filtrar más eficientemente al validar (luego se compara con bcrypt).
 */
@Entity('terminal_api_keys')
@Index('idx_terminal_api_keys_terminal', ['terminalId'])
export class TerminalApiKeyEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'terminal_id' })
  terminalId: string;

  @ManyToOne(() => TerminalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'terminal_id' })
  terminal: TerminalEntity;

  @Column('varchar', { name: 'key_prefix', length: 20 })
  keyPrefix: string;

  @Column('varchar', { name: 'key_hash', length: 255 })
  keyHash: string;

  @Column('varchar', { length: 100, nullable: true })
  label: string | null;

  @Column('timestamptz', { name: 'last_used_at', nullable: true })
  lastUsedAt: Date | null;

  @Column('timestamptz', { name: 'revoked_at', nullable: true })
  revokedAt: Date | null;

  @Column('uuid', { name: 'revoked_by_user_id', nullable: true })
  revokedByUserId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'revoked_by_user_id' })
  revokedBy: UserEntity | null;

  @Column('uuid', { name: 'created_by_user_id' })
  createdByUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
