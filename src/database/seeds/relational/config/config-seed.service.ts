import { Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';

import { GlobalConfigEntity } from '@/modules/config-global/infrastructure/persistence/relational/entities/global-config.entity';

const CONFIG_ITEMS = [
  { key: 'bcv_rate_usd', value: '36.50', description: 'Tasa BCV USD/VES', dataType: 'decimal' },
  { key: 'iva_general_pct', value: '16.00', description: 'IVA general (%)', dataType: 'decimal' },
  { key: 'iva_reduced_pct', value: '8.00', description: 'IVA reducido (%)', dataType: 'decimal' },
  { key: 'igtf_pct', value: '3.00', description: 'IGTF (%)', dataType: 'decimal' },
  { key: 'fefo_alert_days_red', value: '30', description: 'Días alerta FEFO rojo', dataType: 'integer' },
  { key: 'fefo_alert_days_yellow', value: '60', description: 'Días alerta FEFO amarillo', dataType: 'integer' },
  { key: 'fefo_alert_days_orange', value: '90', description: 'Días alerta FEFO naranja', dataType: 'integer' },
];

@Injectable()
export class ConfigSeedService {
  constructor(
    @InjectRepository(GlobalConfigEntity)
    private repository: Repository<GlobalConfigEntity>,
  ) {}

  async run() {
    for (const config of CONFIG_ITEMS) {
      const exists = await this.repository.count({ where: { key: config.key } });
      if (!exists) {
        await this.repository.save(this.repository.create(config));
        console.log(`Config '${config.key}' = '${config.value}' created`);
      }
    }
  }
}
