import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LibroVentasService } from './libro-ventas.service';
import { LibrosIvaController } from './libros-iva.controller';
import { LibroComprasService } from './libro-compras.service';
import { SupplierEntity } from '@/modules/suppliers/infrastructure/persistence/relational/entities/supplier.entity';
import { SaleTicketEntity } from '@/modules/sales/infrastructure/persistence/relational/entities/sale-ticket.entity';
import { GoodsReceiptEntity } from '@/modules/purchases/infrastructure/persistence/relational/entities/goods-receipt.entity';
import { ExchangeRateEntity } from '@/modules/exchange-rates/infrastructure/persistence/relational/entities/exchange-rate.entity';

/**
 * Libros de IVA (Ventas y Compras) conforme a SENIAT.
 *
 * Módulo de solo lectura: agrega datos de sale_tickets y goods_receipts
 * existentes. No modifica nada. Único cambio aditivo: la columna
 * supplier_control_number en goods_receipts (migration 1780000000011).
 */
@Module({
  imports: [TypeOrmModule.forFeature([SaleTicketEntity, GoodsReceiptEntity, SupplierEntity, ExchangeRateEntity])],
  controllers: [LibrosIvaController],
  providers: [LibroVentasService, LibroComprasService],
  exports: [LibroVentasService, LibroComprasService],
})
export class LibrosIvaModule {}
