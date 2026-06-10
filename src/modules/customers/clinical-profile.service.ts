import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException } from '@nestjs/common';

import { CustomerEntity } from './infrastructure/persistence/relational/entities/customer.entity';
import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';
import { PrescriptionEntity } from '@/modules/prescriptions/infrastructure/persistence/relational/entities/prescription.entity';

export type ClinicalProfile = {
  customer: {
    id: string;
    fullName: string;
    documentType: string;
    documentNumber: string;
    phone: string | null;
    customerType: string;
    allergies: string | null;
    chronicConditions: string | null;
    birthDate: string | null;
    /** true si hoy es el cumpleaños del cliente. */
    isBirthdayToday: boolean;
    notes: string | null;
  };
  commercial: {
    /** Total de compras finalizadas (no devoluciones). */
    purchaseCount: number;
    /** Cliente recurrente si tiene ≥ 3 compras. */
    isRecurrent: boolean;
    lastPurchase: {
      date: string;
      daysAgo: number;
      totalUsd: number;
      topProducts: string[];
    } | null;
  };
  pendingPrescriptions: Array<{
    id: string;
    doctorName: string;
    issuedAt: string;
    expiresAt: string | null;
    status: string;
    /** true si vence en ≤ 7 días. */
    expiringSoon: boolean;
    items: Array<{ productName: string; remaining: number }>;
  }>;
  alerts: string[];
};

const RECURRENT_THRESHOLD = 3;
const EXPIRING_SOON_DAYS = 7;

/**
 * Arma el perfil de atención al cliente que el POS muestra al cajero:
 * última compra, recurrencia, alertas clínicas y récipes pendientes.
 *
 * Solo lectura — agrega datos de customers + sale_tickets + prescriptions.
 */
@Injectable()
export class ClinicalProfileService {
  constructor(
    @InjectRepository(CustomerEntity)
    private readonly customerRepo: Repository<CustomerEntity>,
    @InjectRepository(SaleTicketEntity)
    private readonly ticketRepo: Repository<SaleTicketEntity>,
    @InjectRepository(PrescriptionEntity)
    private readonly prescriptionRepo: Repository<PrescriptionEntity>,
  ) {}

  async getProfile(customerId: string): Promise<ClinicalProfile> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Cliente no encontrado');

    const now = new Date();

    // ─── Datos comerciales ────────────────────────────────────────────
    const purchaseCount = await this.ticketRepo.count({
      where: { customerId, status: 'finalized', type: 'sale' },
    });

    const lastTicket = await this.ticketRepo.findOne({
      where: { customerId, status: 'finalized', type: 'sale' },
      relations: ['items'],
      order: { createdAt: 'DESC' },
    });

    let lastPurchase: ClinicalProfile['commercial']['lastPurchase'] = null;
    if (lastTicket) {
      const created = lastTicket.createdAt instanceof Date ? lastTicket.createdAt : new Date(lastTicket.createdAt);
      const daysAgo = Math.max(0, Math.floor((now.getTime() - created.getTime()) / 86400000));
      const topProducts = (lastTicket.items ?? [])
        .slice(0, 3)
        .map((i) => i.productName)
        .filter(Boolean);
      lastPurchase = {
        date: created.toISOString(),
        daysAgo,
        totalUsd: Number(lastTicket.totalUsd) || 0,
        topProducts,
      };
    }

    // ─── Récipes pendientes ───────────────────────────────────────────
    const prescs = await this.prescriptionRepo.find({
      where: [
        { customerId, status: 'active' },
        { customerId, status: 'partially_dispensed' },
      ],
      relations: ['items', 'items.product'],
      order: { issuedAt: 'DESC' },
    });

    const pendingPrescriptions = prescs
      .filter((p) => {
        if (p.expiresAt && new Date(p.expiresAt) < now) return false;
        return (p.items ?? []).some((i) => Number(i.quantityDispensed) < Number(i.quantityPrescribed));
      })
      .map((p) => {
        const expiresAt = p.expiresAt ? new Date(p.expiresAt) : null;
        const expiringSoon = expiresAt ? (expiresAt.getTime() - now.getTime()) / 86400000 <= EXPIRING_SOON_DAYS : false;
        return {
          id: p.id,
          doctorName: p.doctorName,
          issuedAt: (p.issuedAt instanceof Date ? p.issuedAt : new Date(p.issuedAt)).toISOString(),
          expiresAt: expiresAt ? expiresAt.toISOString() : null,
          status: p.status,
          expiringSoon,
          items: (p.items ?? [])
            .filter((i) => Number(i.quantityDispensed) < Number(i.quantityPrescribed))
            .map((i) => ({
              productName: i.product?.shortName ?? i.product?.description ?? i.productId,
              remaining: Number(i.quantityPrescribed) - Number(i.quantityDispensed),
            })),
        };
      });

    // ─── Cumpleaños ────────────────────────────────────────────────────
    const birthDate = customer.birthDate ? new Date(customer.birthDate) : null;
    const isBirthdayToday =
      !!birthDate && birthDate.getUTCMonth() === now.getUTCMonth() && birthDate.getUTCDate() === now.getUTCDate();

    // ─── Alertas para el cajero ────────────────────────────────────────
    const alerts: string[] = [];
    if (customer.allergies?.trim()) alerts.push(`Alergias: ${customer.allergies.trim()}`);
    if (customer.chronicConditions?.trim()) {
      alerts.push(`Condiciones: ${customer.chronicConditions.trim()}`);
    }
    if (pendingPrescriptions.some((p) => p.expiringSoon)) {
      alerts.push('Tiene récipe(s) próximo(s) a vencer');
    }
    if (isBirthdayToday) alerts.push('¡Hoy es su cumpleaños! 🎉');

    return {
      customer: {
        id: customer.id,
        fullName: customer.fullName,
        documentType: customer.documentType,
        documentNumber: customer.documentNumber,
        phone: customer.phone,
        customerType: customer.customerType,
        allergies: customer.allergies,
        chronicConditions: customer.chronicConditions,
        birthDate: birthDate ? birthDate.toISOString().slice(0, 10) : null,
        isBirthdayToday,
        notes: customer.notes,
      },
      commercial: {
        purchaseCount,
        isRecurrent: purchaseCount >= RECURRENT_THRESHOLD,
        lastPurchase,
      },
      pendingPrescriptions,
      alerts,
    };
  }
}
