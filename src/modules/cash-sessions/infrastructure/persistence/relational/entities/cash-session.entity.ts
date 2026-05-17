import {
  Index,
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { CashMovementEntity } from './cash-movement.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';
import { BranchEntity } from '@/modules/branches/infrastructure/persistence/relational/entities/branch.entity';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';

/**
 * Sesión de caja (turno) por terminal. Sólo una puede estar `open` por
 * terminal a la vez (constraint a nivel BD).
 *
 * Apertura: declara los montos iniciales en USD/Bs que hay físicamente en
 * la gaveta. Esto se asienta como un movement type='opening'.
 *
 * Cierre: el cajero declara los montos físicos finales por método; el
 * sistema calcula los esperados sumando movements; la diferencia se
 * registra y se persiste.
 */
export type CashSessionStatus = 'open' | 'closed' | 'audited';

@Entity('cash_sessions')
@Index('idx_cash_sessions_terminal', ['terminalId'])
@Index('idx_cash_sessions_branch', ['branchId'])
@Index('idx_cash_sessions_status', ['status'])
export class CashSessionEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'terminal_id' })
  terminalId: string;

  @ManyToOne(() => TerminalEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'terminal_id' })
  terminal: TerminalEntity;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @ManyToOne(() => BranchEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'branch_id' })
  branch: BranchEntity;

  @Column('uuid', { name: 'opened_by_user_id' })
  openedByUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'opened_by_user_id' })
  openedBy: UserEntity;

  @Column('timestamptz', { name: 'opened_at' })
  openedAt: Date;

  @Column('numeric', { name: 'opening_amount_usd', precision: 18, scale: 4, default: 0 })
  openingAmountUsd: number;

  @Column('numeric', { name: 'opening_amount_bs', precision: 18, scale: 2, default: 0 })
  openingAmountBs: number;

  @Column('uuid', { name: 'closed_by_user_id', nullable: true })
  closedByUserId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'closed_by_user_id' })
  closedBy: UserEntity | null;

  @Column('timestamptz', { name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @Column('numeric', { name: 'closing_declared_usd', precision: 18, scale: 4, nullable: true })
  closingDeclaredUsd: number | null;

  @Column('numeric', { name: 'closing_declared_bs', precision: 18, scale: 2, nullable: true })
  closingDeclaredBs: number | null;

  @Column('numeric', { name: 'closing_calculated_usd', precision: 18, scale: 4, nullable: true })
  closingCalculatedUsd: number | null;

  @Column('numeric', { name: 'closing_calculated_bs', precision: 18, scale: 2, nullable: true })
  closingCalculatedBs: number | null;

  @Column('numeric', { name: 'difference_usd', precision: 18, scale: 4, nullable: true })
  differenceUsd: number | null;

  @Column('numeric', { name: 'difference_bs', precision: 18, scale: 2, nullable: true })
  differenceBs: number | null;

  @Column('varchar', { length: 20, default: 'open' })
  status: CashSessionStatus;

  @Column('text', { nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => CashMovementEntity, (m) => m.cashSession)
  movements: CashMovementEntity[];
}
