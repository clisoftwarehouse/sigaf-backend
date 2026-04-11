import { Index, Column, Entity, CreateDateColumn, PrimaryGeneratedColumn } from 'typeorm';

import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('warehouse_locations_branch_id_location_code_key', ['branchId', 'locationCode'], { unique: true })
@Entity('warehouse_locations')
export class WarehouseLocationEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'branch_id' })
  branchId: string;

  @Column('varchar', { name: 'aisle', nullable: true, length: 10 })
  aisle: string | null;

  @Column('varchar', { name: 'shelf', nullable: true, length: 10 })
  shelf: string | null;

  @Column('varchar', { name: 'section', nullable: true, length: 10 })
  section: string | null;

  @Column('decimal', { name: 'capacity', nullable: true, precision: 12, scale: 3 })
  capacity: number | null;

  @Column('varchar', { name: 'location_code', length: 30 })
  locationCode: string;

  @Column('boolean', { name: 'is_quarantine', default: false })
  isQuarantine: boolean;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
