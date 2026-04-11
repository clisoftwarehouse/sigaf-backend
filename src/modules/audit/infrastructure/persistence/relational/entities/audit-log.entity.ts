import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('idx_audit_log_table', ['tableName', 'recordId'], {})
@Index('idx_audit_log_user', ['userId', 'createdAt'], {})
@Entity('audit_log')
export class AuditLogEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('varchar', { name: 'table_name', length: 100 })
  tableName: string;

  @Column('uuid', { name: 'record_id' })
  recordId: string;

  @Column('varchar', { name: 'action', length: 10 })
  action: string;

  @Column('jsonb', { name: 'old_values', nullable: true })
  oldValues: Record<string, unknown> | null;

  @Column('jsonb', { name: 'new_values', nullable: true })
  newValues: Record<string, unknown> | null;

  @Column('text', { name: 'changed_fields', array: true, nullable: true })
  changedFields: string[] | null;

  @Column('text', { name: 'justification', nullable: true })
  justification: string | null;

  @Column('uuid', { name: 'user_id' })
  userId: string;

  @Column('uuid', { name: 'terminal_id', nullable: true })
  terminalId: string | null;

  @Column('inet', { name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
