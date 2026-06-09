import { Module } from '@nestjs/common';

import { PurchasesComparatorService } from './purchases-comparator.service';
import { PurchasesComparatorController } from './purchases-comparator.controller';

@Module({
  controllers: [PurchasesComparatorController],
  providers: [PurchasesComparatorService],
})
export class PurchasesComparatorModule {}
