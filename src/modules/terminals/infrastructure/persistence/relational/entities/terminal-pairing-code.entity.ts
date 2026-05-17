import { Index, Column, Entity, ManyToOne, JoinColumn, PrimaryColumn, CreateDateColumn } from 'typeorm';

import { TerminalEntity } from './terminal.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

/**
 * Código de un solo uso para emparejar un PC con un terminal del backend.
 * Vigencia corta (10 min). Una vez consumido se persiste `consumedAt` y
 * el código no puede volver a usarse.
 */
@Entity('terminal_pairing_codes')
@Index('idx_terminal_pairing_codes_terminal', ['terminalId'])
export class TerminalPairingCodeEntity extends EntityRelationalHelper {
  @PrimaryColumn('varchar', { length: 20 })
  code: string;

  @Column('uuid', { name: 'terminal_id' })
  terminalId: string;

  @ManyToOne(() => TerminalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'terminal_id' })
  terminal: TerminalEntity;

  @Column('timestamptz', { name: 'expires_at' })
  expiresAt: Date;

  @Column('timestamptz', { name: 'consumed_at', nullable: true })
  consumedAt: Date | null;

  @Column('uuid', { name: 'consumed_by_user_id', nullable: true })
  consumedByUserId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'consumed_by_user_id' })
  consumedBy: UserEntity | null;

  @Column('uuid', { name: 'created_by_user_id' })
  createdByUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
