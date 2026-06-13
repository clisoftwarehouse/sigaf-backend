import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Logger, Injectable, BadRequestException } from '@nestjs/common';

import { RateSource } from './rate-sources';
import { BcvScraperService } from './bcv-scraper.service';
import { OverrideRateDto, CreateExchangeRateDto } from './dto';
import { ExchangeRateEntity } from './infrastructure/persistence/relational/entities/exchange-rate.entity';

@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);

  constructor(
    @InjectRepository(ExchangeRateEntity)
    private readonly repo: Repository<ExchangeRateEntity>,
    private readonly bcvScraper: BcvScraperService,
  ) {}

  async findAll(query: {
    currencyFrom?: string;
    currencyTo?: string;
    source?: string;
    limit?: number;
  }): Promise<ExchangeRateEntity[]> {
    const qb = this.repo.createQueryBuilder('er');

    if (query.currencyFrom) {
      qb.andWhere('er.currencyFrom = :currencyFrom', { currencyFrom: query.currencyFrom });
    }
    if (query.currencyTo) {
      qb.andWhere('er.currencyTo = :currencyTo', { currencyTo: query.currencyTo });
    }
    if (query.source) {
      qb.andWhere('er.source = :source', { source: query.source });
    }

    return qb
      .orderBy('er.effectiveDate', 'DESC')
      .addOrderBy('er.createdAt', 'DESC')
      .take(query.limit || 30)
      .getMany();
  }

  async getLatest(currencyFrom = 'USD', currencyTo = 'VES', source?: RateSource): Promise<ExchangeRateEntity | null> {
    return this.repo.findOne({
      where: {
        currencyFrom,
        currencyTo,
        ...(source ? { source } : {}),
      },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(dto: CreateExchangeRateDto): Promise<ExchangeRateEntity> {
    const currencyFrom = dto.currencyFrom || 'USD';
    const currencyTo = dto.currencyTo || 'VES';
    const source = dto.source || 'BCV';

    // Tasa de reposición NUNCA puede ser menor a la BCV vigente, de lo
    // contrario el negocio pierde poder de reposición en cada venta.
    if (source === 'REPOSICION') {
      await this.assertReposicionNotBelowBcv(dto.rate, currencyFrom, currencyTo);
    }

    const item = this.repo.create({
      ...dto,
      currencyFrom,
      currencyTo,
      source,
    });
    return this.repo.save(item);
  }

  /**
   * Valida que `rate` (tasa de reposición candidata) sea >= a la última tasa
   * BCV vigente. Si no hay BCV registrado, deja pasar (caso edge de primer
   * arranque del sistema).
   */
  private async assertReposicionNotBelowBcv(rate: number, currencyFrom: string, currencyTo: string): Promise<void> {
    const bcv = await this.repo.findOne({
      where: { currencyFrom, currencyTo, source: 'BCV' },
      order: { effectiveDate: 'DESC', createdAt: 'DESC' },
    });
    if (!bcv) return;
    if (Number(rate) < Number(bcv.rate)) {
      throw new BadRequestException(
        `La tasa de reposición (${rate}) no puede ser menor a la tasa BCV vigente (${bcv.rate}). Esto causaría pérdidas al revalorizar precios.`,
      );
    }
  }

  /**
   * Consulta la tasa oficial USD→VES del BCV y la persiste. Si ya existe una
   * tasa con la misma `effectiveDate` se retorna la existente (idempotente).
   */
  async fetchAndSaveBcvRate(): Promise<ExchangeRateEntity> {
    const { rate, effectiveDate } = await this.bcvScraper.fetchUsdVes();
    const existing = await this.repo.findOne({
      where: {
        currencyFrom: 'USD',
        currencyTo: 'VES',
        source: 'BCV',
        effectiveDate,
      },
    });
    if (existing) {
      // Misma fecha pero tasa distinta → el BCV corrigió o el valor previo
      // quedó stale. "Actualizar" debe reflejar el valor vigente del API.
      if (Number(existing.rate) !== Number(rate)) {
        existing.rate = rate;
        const updated = await this.repo.save(existing);
        this.logger.log(`Tasa BCV del ${effectiveDate.toISOString().slice(0, 10)} actualizada a ${rate}`);
        return updated;
      }
      this.logger.log(`Tasa BCV del ${effectiveDate.toISOString().slice(0, 10)} ya registrada (${existing.rate})`);
      return existing;
    }
    const saved = await this.repo.save(
      this.repo.create({
        currencyFrom: 'USD',
        currencyTo: 'VES',
        source: 'BCV',
        rate,
        effectiveDate,
        isOverridden: false,
      }),
    );
    this.logger.log(`Tasa BCV guardada: ${rate} efectiva ${effectiveDate.toISOString().slice(0, 10)}`);
    return saved;
  }

  /**
   * Sobreescribe manualmente la tasa del día. Marca el registro con
   * `is_overridden=true` y `source='manual'` para distinguirlo del BCV.
   */
  async overrideRate(dto: OverrideRateDto): Promise<ExchangeRateEntity> {
    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : new Date();
    const saved = await this.repo.save(
      this.repo.create({
        currencyFrom: dto.currencyFrom || 'USD',
        currencyTo: dto.currencyTo || 'VES',
        source: 'manual',
        rate: dto.rate,
        effectiveDate,
        isOverridden: true,
      }),
    );
    this.logger.warn(`Tasa sobreescrita manualmente: ${dto.rate} (${effectiveDate.toISOString().slice(0, 10)})`);
    return saved;
  }

  /**
   * CRON diario a las 08:00 (hora del server). Consulta la tasa BCV y la
   * guarda si no existe aún. Tolera fallos sin reventar la aplicación.
   */
  @Cron(CronExpression.EVERY_DAY_AT_8AM, { name: 'fetch-bcv-rate' })
  async scheduledBcvFetch(): Promise<void> {
    try {
      await this.fetchAndSaveBcvRate();
    } catch (err) {
      this.logger.error(`[fetch-bcv-rate] fallo: ${(err as Error).message}`);
    }
  }
}
