import { Repository, DataSource } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';

import { RegisterPaymentDto } from '../dto';
import { AccountsPayableEntity } from '../infrastructure/persistence/relational/entities/accounts-payable.entity';
import { AccountsPayablePaymentEntity } from '../infrastructure/persistence/relational/entities/accounts-payable-payment.entity';

/**
 * Registro y reversa de pagos contra CxP.
 *
 * Invariantes que mantenemos en una sola transacción:
 *  - SUM(amount_usd de pagos vigentes) <= original_amount_usd
 *  - cxp.paid_amount_usd = SUM(pagos vigentes)
 *  - cxp.balance_usd = original - paid
 *  - status: open si paid=0, partial si 0<paid<original, paid si paid>=original
 */
@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(AccountsPayableEntity)
    private readonly cxpRepo: Repository<AccountsPayableEntity>,
    @InjectRepository(AccountsPayablePaymentEntity)
    private readonly paymentRepo: Repository<AccountsPayablePaymentEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async listForCxp(cxpId: string): Promise<AccountsPayablePaymentEntity[]> {
    return this.paymentRepo.find({
      where: { accountsPayableId: cxpId },
      order: { paymentDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async registerPayment(
    cxpId: string,
    dto: RegisterPaymentDto,
    userId: string,
  ): Promise<{ payment: AccountsPayablePaymentEntity; cxp: AccountsPayableEntity }> {
    return this.dataSource.transaction(async (manager) => {
      const cxp = await manager.findOne(AccountsPayableEntity, { where: { id: cxpId } });
      if (!cxp) throw new NotFoundException('Cuenta por pagar no encontrada');
      if (cxp.status === 'cancelled') {
        throw new BadRequestException('No se puede pagar una CxP cancelada');
      }
      if (cxp.status === 'paid') {
        throw new BadRequestException('La CxP ya está completamente pagada');
      }

      const amountUsd = Number(dto.amountUsd);
      if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
        throw new BadRequestException('El monto del pago debe ser mayor a cero');
      }

      const currentPaid = Number(cxp.paidAmountUsd) || 0;
      const original = Number(cxp.originalAmountUsd) || 0;
      const wouldBePaid = currentPaid + amountUsd;
      // Tolerancia de 1 centavo para evitar problemas de redondeo VES↔USD.
      if (wouldBePaid > original + 0.01) {
        throw new BadRequestException(
          `El pago excede el saldo pendiente. Saldo: ${(original - currentPaid).toFixed(2)} USD · Pago: ${amountUsd.toFixed(2)} USD`,
        );
      }

      const payment = manager.create(AccountsPayablePaymentEntity, {
        accountsPayableId: cxpId,
        paymentDate: dto.paymentDate ? new Date(dto.paymentDate) : new Date(),
        amountUsd,
        amountNative: Number(dto.amountNative),
        currencyNative: dto.currencyNative,
        exchangeRate: dto.exchangeRate ?? null,
        method: dto.method,
        reference: dto.reference ?? null,
        notes: dto.notes ?? null,
        paidByUserId: userId,
      });
      const savedPayment = await manager.save(payment);

      const newPaid = Math.min(original, round4(wouldBePaid));
      const newBalance = round4(Math.max(0, original - newPaid));
      const newStatus = newBalance < 0.01 ? 'paid' : 'partial';

      cxp.paidAmountUsd = newPaid;
      cxp.balanceUsd = newBalance;
      cxp.status = newStatus;
      const savedCxp = await manager.save(cxp);

      return { payment: savedPayment, cxp: savedCxp };
    });
  }

  async reversePayment(
    paymentId: string,
    reason: string,
    userId: string,
  ): Promise<{ payment: AccountsPayablePaymentEntity; cxp: AccountsPayableEntity }> {
    return this.dataSource.transaction(async (manager) => {
      const payment = await manager.findOne(AccountsPayablePaymentEntity, { where: { id: paymentId } });
      if (!payment) throw new NotFoundException('Pago no encontrado');
      if (payment.reversedAt) {
        throw new BadRequestException('Este pago ya fue revertido');
      }
      if (!reason || reason.trim().length === 0) {
        throw new BadRequestException('Debe indicar el motivo de la reversa');
      }

      payment.reversedAt = new Date();
      payment.reversedByUserId = userId;
      payment.reversedReason = reason.trim();
      const savedPayment = await manager.save(payment);

      // Recalcular paid y status del CxP.
      const cxp = await manager.findOne(AccountsPayableEntity, { where: { id: payment.accountsPayableId } });
      if (!cxp) throw new NotFoundException('Cuenta por pagar no encontrada');

      const activePayments = await manager.find(AccountsPayablePaymentEntity, {
        where: { accountsPayableId: cxp.id },
      });
      const newPaid = activePayments.filter((p) => !p.reversedAt).reduce((s, p) => s + (Number(p.amountUsd) || 0), 0);

      const original = Number(cxp.originalAmountUsd) || 0;
      cxp.paidAmountUsd = round4(newPaid);
      cxp.balanceUsd = round4(Math.max(0, original - newPaid));
      cxp.status =
        cxp.status === 'cancelled'
          ? 'cancelled'
          : newPaid < 0.01
            ? 'open'
            : newPaid >= original - 0.01
              ? 'paid'
              : 'partial';
      const savedCxp = await manager.save(cxp);

      return { payment: savedPayment, cxp: savedCxp };
    });
  }
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
