import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { CreateExchangeRateDto } from './dto';
import { ExchangeRateEntity } from './infrastructure/persistence/relational/entities/exchange-rate.entity';

@Injectable()
export class ExchangeRatesService {
  constructor(
    @InjectRepository(ExchangeRateEntity)
    private readonly repo: Repository<ExchangeRateEntity>,
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
}
