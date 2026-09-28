import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogClient, HttpCatalogClient } from './catalog.client.js';
import { Order, OrderItem, OrderStatusChange } from './order.entity.js';
import { OrdersController } from './orders.controller.js';
import { OrdersSaga } from './orders.saga.js';
import { OrdersService } from './orders.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Order, OrderItem, OrderStatusChange])],
  controllers: [OrdersController],
  providers: [
    OrdersService,
    OrdersSaga,
    { provide: CatalogClient, useClass: HttpCatalogClient },
  ],
})
export class OrdersModule {}
