import { Column, Entity, ManyToOne, JoinColumn, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { ConsignmentLiquidationEntity } from './consignment-liquidation.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Entity('consignment_liquidation_items')
export class ConsignmentLiquidationItemEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'liquidation_id' })
  liquidationId: string;

  @Column('uuid', { name: 'consignment_item_id' })
  consignmentItemId: string;

  @Column('uuid', { name: 'sale_ticket_item_id', nullable: true })
  saleTicketItemId: string | null;

  @Column('decimal', { name: 'quantity_liquidated', precision: 12, scale: 3 })
  quantityLiquidated: number;

  @Column('decimal', { name: 'sale_price_usd', precision: 18, scale: 4 })
  salePriceUsd: number;

  @Column('decimal', { name: 'cost_usd', precision: 18, scale: 4 })
  costUsd: number;

  @Column('decimal', { name: 'commission_usd', precision: 18, scale: 4 })
  commissionUsd: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => ConsignmentLiquidationEntity)
  @JoinColumn({ name: 'liquidation_id' })
  liquidation: ConsignmentLiquidationEntity;
}
