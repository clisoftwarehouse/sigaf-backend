import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

/**
 * Contador atómico de ticket_number por terminal. Se incrementa con
 * UPDATE ... RETURNING para garantizar serialización sin lock global.
 */
@Entity('terminal_ticket_counters')
export class TerminalTicketCounterEntity extends EntityRelationalHelper {
  @PrimaryColumn('uuid', { name: 'terminal_id' })
  terminalId: string;

  @Column('int', { name: 'last_number', default: 0 })
  lastNumber: number;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
