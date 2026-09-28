import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrderSummaryController } from './composition/order-summary.controller.js';
import { DocsController } from './docs/docs.controller.js';
import { HealthController } from './health/health.controller.js';
import { RegistryModule } from './registry/registry.module.js';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), RegistryModule],
  controllers: [HealthController, OrderSummaryController, DocsController],
})
export class AppModule {}
