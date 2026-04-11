import { Column, Entity, CreateDateColumn, UpdateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('terminals')
export class TerminalEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { length: 20, unique: true })
  code: string;

  @Column('varchar', { length: 100, nullable: true })
  name: string | null;

  @Column('jsonb', { name: 'fiscal_printer_config', nullable: true })
  fiscalPrinterConfig: Record<string, unknown> | null;

  @Column('jsonb', { name: 'scale_config', nullable: true })
  scaleConfig: Record<string, unknown> | null;

  @Column('jsonb', { name: 'cash_drawer_config', nullable: true })
  cashDrawerConfig: Record<string, unknown> | null;

  @Column('timestamptz', { name: 'last_sync_at', nullable: true })
  lastSyncAt: Date | null;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
