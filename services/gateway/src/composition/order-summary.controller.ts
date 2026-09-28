import {
  Controller,
  Get,
  HttpException,
  Param,
  ParseUUIDPipe,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ServiceName } from '../registry/services.registry.js';
import { UpstreamClient, UpstreamError } from '../registry/upstream.client.js';

/**
 * API composition: one call returns what four services know about an order.
 * The order itself is required; the rest degrades gracefully to `null`.
 */
@ApiTags('gateway')
@Controller('api/orders')
export class OrderSummaryController {
  constructor(private readonly upstream: UpstreamClient) {}

  @Get(':id/summary')
  @ApiOkResponse({
    description:
      'Order + payment + stock reservations + notifications. `unavailable` lists services that did not answer.',
  })
  async summary(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const requestId = req.headers['x-request-id'] as string;
    const get = <T>(service: ServiceName, path: string) =>
      this.upstream.getJson<T>(service, path, { requestId });

    const [order, payment, reservations, notifications] =
      await Promise.allSettled([
        get<Record<string, unknown>>('orders', `/orders/${id}`),
        get<Record<string, unknown>>('payments', `/payments/${id}`),
        get<unknown[]>('inventory', `/reservations?orderId=${id}`),
        get<unknown[]>(
          'notifications',
          `/notifications?orderId=${id}&limit=50`,
        ),
      ]);

    if (order.status === 'rejected') {
      const error = order.reason as UpstreamError;
      if (error.status && error.status < 500) {
        throw new HttpException(`Order ${id} not found`, error.status);
      }
      throw new ServiceUnavailableException(
        'The orders service is unavailable',
      );
    }

    const unavailable: ServiceName[] = [];
    const optional = <T>(
      result: PromiseSettledResult<T>,
      service: ServiceName,
      fallback: T | null,
    ): T | null => {
      if (result.status === 'fulfilled') return result.value;
      const error = result.reason as UpstreamError;
      // 404 from payments just means the intent does not exist yet.
      if (error.status !== 404) unavailable.push(service);
      return fallback;
    };

    return {
      order: order.value,
      payment: optional(payment, 'payments', null),
      reservations: optional(reservations, 'inventory', []),
      notifications: optional(notifications, 'notifications', []),
      unavailable,
    };
  }
}
