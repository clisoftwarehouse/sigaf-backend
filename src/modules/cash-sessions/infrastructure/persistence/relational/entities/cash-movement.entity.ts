import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { CashSessionEntity } from './cash-session.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { UserEntity } from '@/modules/users/infrastructure/persistence/relational/entities/user.entity';

/**
 * Cada movimiento de caja se asienta acá: aperturas, ventas, devoluciones,
 * payouts (extracciones a banco/dueño), depósitos manuales y ajustes de cuadre.
 *
 * `reference_id` + `reference_type` permiten linkear el movement con el
 * documento que lo generó (sale_ticket, return, etc.) sin acoplar la entidad
 * a esos módulos.
 *
 * Append-only: los movements no se editan ni borran. Para corregir errores se
 * agrega un movement de tipo `adjustment` con monto opuesto y notas.
 */
export type CashMovementType = 'opening' | 'sale' | 'return' | 'payout' | 'deposit' | 'adjustment';

export type CashMovementMethod = 'EFECTIVO_USD' | 'EFECTIVO_BS' | 'PAGO_MOVIL' | 'TDD' | 'TDC' | 'ZELLE' | 'OTRO';

@Entity('cash_movements')
@Index('idx_cash_movements_session', ['cashSessionId'])
@Index('idx_cash_movements_reference', ['referenceType', 'referenceId'])
export class CashMovementEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'cash_session_id' })
  cashSessionId: string;

  @ManyToOne(() => CashSessionEntity, (s) => s.movements, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cash_session_id' })
  cashSession: CashSessionEntity;

  @Column('varchar', { length: 20 })
  type: CashMovementType;

  @Column('varchar', { name: 'payment_method', length: 30 })
  paymentMethod: CashMovementMethod;

  @Column('numeric', { name: 'amount_usd', precision: 18, scale: 4 })
  amountUsd: number;

  @Column('numeric', { name: 'amount_bs', precision: 18, scale: 2, default: 0 })
  amountBs: number;

  @Column('numeric', {
    name: 'exchange_rate_used',
    precision: 18,
    scale: 6,
    nullable: true,
  })
  exchangeRateUsed: number | null;

  @Column('uuid', { name: 'reference_id', nullable: true })
  referenceId: string | null;

  @Column('varchar', { name: 'reference_type', length: 30, nullable: true })
  referenceType: string | null;

  @Column('text', { nullable: true })
  notes: string | null;

  @Column('uuid', { name: 'created_by_user_id', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'created_by_user_id' })
  createdBy: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
