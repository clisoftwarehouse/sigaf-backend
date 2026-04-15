import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { InventoryService } from './inventory.service';
import { ProductEntity } from '../products/infrastructure/persistence/relational/entities/product.entity';
import { InventoryLotEntity } from './infrastructure/persistence/relational/entities/inventory-lot.entity';
import { InventoryCyclicScheduleEntity } from './infrastructure/persistence/relational/entities/inventory-cyclic-schedule.entity';

@Injectable()
export class InventoryJobsService {
  private readonly logger = new Logger(InventoryJobsService.name);

  constructor(
    @InjectRepository(InventoryLotEntity)
    private readonly lotRepo: Repository<InventoryLotEntity>,
    @InjectRepository(InventoryCyclicScheduleEntity)
    private readonly scheduleRepo: Repository<InventoryCyclicScheduleEntity>,
    @InjectRepository(ProductEntity)
    private readonly productRepo: Repository<ProductEntity>,
    private readonly inventoryService: InventoryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_6AM, { name: 'expiry-alerts' })
  async runExpiryAlerts(): Promise<{ expired: number }> {
    this.logger.log('[expiry-alerts] inicio');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiredLots = await this.lotRepo
      .createQueryBuilder('lot')
      .where("lot.status = 'available'")
      .andWhere('lot.quantityAvailable > 0')
      .andWhere('lot.expirationDate <= :today', { today })
      .getMany();

    for (const lot of expiredLots) {
      const oldQuantity = Number(lot.quantityAvailable);
      lot.status = 'expired';
      lot.quantityAvailable = 0;
      await this.lotRepo.save(lot);

      try {
        await this.inventoryService.createAdjustment(
          {
            productId: lot.productId,
            lotId: lot.id,
            branchId: lot.branchId,
            adjustmentType: 'expiry_write_off',
            quantity: -oldQuantity,
            reason: `Vencimiento automático del lote ${lot.lotNumber}`,
          },
          'system',
        );
      } catch (err) {
        this.logger.warn(`No se pudo registrar ajuste para lote ${lot.id}: ${(err as Error).message}`);
      }
    }

    this.logger.log(`[expiry-alerts] ${expiredLots.length} lotes vencidos`);
    return { expired: expiredLots.length };
  }

  @Cron(CronExpression.EVERY_DAY_AT_7AM, { name: 'cyclic-counts' })
  async runCyclicCounts(): Promise<{ generated: number }> {
    this.logger.log('[cyclic-counts] inicio');

    const now = new Date();
    const dueSchedules = await this.scheduleRepo
      .createQueryBuilder('s')
      .where('s.isActive = true')
      .andWhere('s.autoGenerate = true')
      .andWhere('(s.nextGenerationAt IS NULL OR s.nextGenerationAt <= :now)', { now })
      .getMany();

    let generated = 0;
    for (const schedule of dueSchedules) {
      try {
        const products = await this.productRepo
          .createQueryBuilder('p')
          .where('p.isActive = true')
          .orderBy('p.updatedAt', 'ASC')
          .limit(schedule.maxSkusPerCount)
          .getMany();

        if (products.length === 0) {
          this.logger.warn(`[cyclic-counts] schedule ${schedule.id} sin productos elegibles`);
        } else {
          await this.inventoryService.createCount(
            {
              branchId: schedule.branchId,
              countType: 'cycle',
              productIds: products.map((p) => p.id),
              notes: `Generado por programa cíclico '${schedule.name}'`,
            },
            schedule.createdBy,
          );
          generated++;
        }

        schedule.lastGeneratedAt = now;
        const next = new Date(now);
        next.setDate(next.getDate() + schedule.frequencyDays);
        schedule.nextGenerationAt = next;
        await this.scheduleRepo.save(schedule);
      } catch (err) {
        this.logger.error(`[cyclic-counts] schedule ${schedule.id} falló: ${(err as Error).message}`);
      }
    }

    this.logger.log(`[cyclic-counts] ${generated} órdenes generadas`);
    return { generated };
  }
}
