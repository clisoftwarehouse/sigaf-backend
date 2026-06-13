import {
  Index,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  UpdateDateColumn,
  CreateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { TerminalEntity } from '@/modules/terminals/infrastructure/persistence/relational/entities/terminal.entity';

/**
 * Método de emisión de documentos configurado para un terminal.
 *
 * `methodKey` es string (no enum) a propósito: agregar/quitar plugins NUNCA
 * debe requerir migración. Si un plugin desaparece, su fila queda huérfana
 * inofensiva y el loader la ignora (no encuentra handler para esa key).
 *
 * Solo se configuran aquí métodos legales/declarables (HKA fiscal, nota de
 * entrega, recibo provisional, factura electrónica). Métodos puramente locales
 * del POS no se registran en backend.
 */
@Entity('document_emission_methods')
@Index('ux_dem_terminal_method', ['terminalId', 'methodKey'], { unique: true })
export class DocumentEmissionMethodEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'terminal_id' })
  terminalId: string;

  @ManyToOne(() => TerminalEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'terminal_id' })
  terminal: TerminalEntity;

  @Column('varchar', { name: 'method_key', length: 50 })
  methodKey: string;

  @Column('jsonb', { name: 'config_json', default: {} })
  configJson: Record<string, unknown>;

  @Column('int', { default: 100 })
  priority: number;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
