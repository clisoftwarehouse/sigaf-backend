import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Logger, Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

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

  async findAll(query: { currencyFrom?: string; currencyTo?: string; limit?: number }): Promise<ExchangeRateEntity[]> {
    const qb = this.repo.createQueryBuilder('er');

    if (query.currencyFrom) {
      qb.andWhere('er.currencyFrom = :currencyFrom', { currencyFrom: query.currencyFrom });
    }
    if (query.currencyTo) {
      qb.andWhere('er.currencyTo = :currencyTo', { currencyTo: query.currencyTo });
    }

    return qb
      .orderBy('er.effectiveDate', 'DESC')
      .take(query.limit || 30)
      .getMany();
  }

  async getLatest(currencyFrom = 'USD', currencyTo = 'VES'): Promise<ExchangeRateEntity | null> {
    return this.repo.findOne({
      where: { currencyFrom, currencyTo },
      order: { effectiveDate: 'DESC' },
    });
  }

  async create(dto: CreateExchangeRateDto): Promise<ExchangeRateEntity> {
    const item = this.repo.create({
      ...dto,
      currencyFrom: dto.currencyFrom || 'USD',
      currencyTo: dto.currencyTo || 'VES',
      source: dto.source || 'BCV',
    });
    return this.repo.save(item);
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
