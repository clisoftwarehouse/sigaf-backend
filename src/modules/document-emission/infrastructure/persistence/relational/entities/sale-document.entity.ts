import { Index, Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';
import { DocumentEmissionMethodEntity } from './document-emission-method.entity';
import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';

/**
 * Documento efectivamente emitido a partir de una venta. UN row por documento.
 *
 * La AUSENCIA de row significa "no se emitió documento" — sin distinguir el
 * motivo (configuración, método local sin reporte, etc.). Un auditor solo lee
 * "salidas pendientes por facturar"; el kardex justifica el movimiento físico.
 *
 * Un ticket puede tener 0, 1 o N documentos (ej. nota de entrega + factura
 * fiscal después). Sin CASCADE ni UNIQUE por ticket.
 */
@Entity('sale_documents')
@Index('idx_sd_ticket', ['saleTicketId'])
@Index('idx_sd_type', ['documentType', 'createdAt'])
export class SaleDocumentEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'sale_ticket_id' })
  saleTicketId: string;

  @ManyToOne(() => SaleTicketEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sale_ticket_id' })
  saleTicket: SaleTicketEntity;

  @Column('varchar', { name: 'document_type', length: 50 })
  documentType: string;

  @Column('varchar', { name: 'document_number', length: 50, nullable: true })
  documentNumber: string | null;

  @Column('varchar', { name: 'control_number', length: 50, nullable: true })
  controlNumber: string | null;

  @Column('uuid', { name: 'emission_method_id', nullable: true })
  emissionMethodId: string | null;

  @ManyToOne(() => DocumentEmissionMethodEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'emission_method_id' })
  emissionMethod: DocumentEmissionMethodEntity | null;

  @Column('jsonb', { name: 'raw_response_json', nullable: true })
  rawResponseJson: Record<string, unknown> | null;

  @Column('varchar', { length: 20, default: 'emitted' })
  status: string;

  @Column('text', { name: 'failure_reason', nullable: true })
  failureReason: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
