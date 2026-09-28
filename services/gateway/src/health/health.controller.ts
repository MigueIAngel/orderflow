import { Controller, Get, Req } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ServicesRegistry } from '../registry/services.registry.js';
import { UpstreamClient } from '../registry/upstream.client.js';

interface ServiceHealth {
  status: 'up' | 'degraded' | 'down';
  latencyMs: number | null;
  circuit: string;
  checks?: Record<string, string>;
}

@ApiTags('gateway')
@Controller('api/health')
export class HealthController {
  constructor(
    private readonly registry: ServicesRegistry,
    private readonly upstream: UpstreamClient,
  ) {}

  /** Checks every service in parallel. The UI uses it to show which services are awake. */
  @Get()
  @ApiOkResponse({
    description: 'Aggregated health of the gateway and all services',
  })
  async check(@Req() req: Request) {
    const requestId = req.headers['x-request-id'] as string;
    const entries = await Promise.all(
      this.registry.routes.map(
        async (route): Promise<[string, ServiceHealth]> => {
          const started = performance.now();
          try {
            const body = await this.upstream.getJson<{
              status: 'up' | 'degraded';
              checks?: Record<string, string>;
            }>(route.name, '/health', { timeoutMs: 4000, requestId });
            return [
              route.name,
              {
                status: body.status === 'up' ? 'up' : 'degraded',
                latencyMs: Math.round(performance.now() - started),
                circuit: route.breaker.state,
                checks: body.checks,
              },
            ];
          } catch {
            return [
              route.name,
              { status: 'down', latencyMs: null, circuit: route.breaker.state },
            ];
          }
        },
      ),
    );
    const services = Object.fromEntries(entries);
    const statuses = entries.map(([, s]) => s.status);
    const status = statuses.every((s) => s === 'up')
      ? 'up'
      : statuses.every((s) => s === 'down')
        ? 'down'
        : 'degraded';
    return { status, gateway: 'up', services };
  }
}
