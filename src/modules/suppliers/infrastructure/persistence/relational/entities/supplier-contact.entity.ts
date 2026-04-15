import {
  Index,
  Column,
  Entity,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SupplierEntity } from './supplier.entity';
import { EntityRelationalHelper } from '@/common/utils/relational-entity-helper';

@Index('IDX_supplier_contacts_supplier', ['supplierId'])
@Entity('supplier_contacts')
export class SupplierContactEntity extends EntityRelationalHelper {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { name: 'supplier_id' })
  supplierId: string;

  @ManyToOne(() => SupplierEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier?: SupplierEntity;

  @Column('varchar', { name: 'full_name', length: 150 })
  fullName: string;

  @Column('varchar', { length: 100, nullable: true })
  role: string | null;

  @Column('varchar', { length: 100, nullable: true })
  department: string | null;

  @Column('varchar', { length: 150, nullable: true })
  email: string | null;

  @Column('varchar', { length: 20, nullable: true })
  phone: string | null;

  @Column('varchar', { length: 20, nullable: true })
  mobile: string | null;

  @Column('boolean', { name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column('boolean', { name: 'is_active', default: true })
  isActive: boolean;

  @Column('text', { nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
