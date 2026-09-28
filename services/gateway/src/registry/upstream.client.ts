import { Injectable } from '@nestjs/common';
import { ServicesRegistry, ServiceName } from './services.registry.js';

export class UpstreamError extends Error {
  constructor(
    readonly service: ServiceName,
    readonly status: number | null,
    message: string,
  ) {
    super(message);
  }
}

/** JSON calls from the gateway itself (health, docs, composition), guarded by the breakers. */
@Injectable()
export class UpstreamClient {
  constructor(private readonly registry: ServicesRegistry) {}

  async getJson<T>(
    service: ServiceName,
    path: string,
    {
      timeoutMs = 3000,
      requestId,
    }: { timeoutMs?: number; requestId?: string } = {},
  ): Promise<T> {
    const route = this.registry.get(service)!;
    if (!route.breaker.canRequest()) {
      throw new UpstreamError(service, null, `${service} circuit is open`);
    }
    let response: Response;
    try {
      response = await fetch(`${route.url}${path}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: requestId ? { 'x-request-id': requestId } : {},
      });
    } catch (error) {
      route.breaker.failure();
      throw new UpstreamError(
        service,
        null,
        `${service} unreachable: ${String(error)}`,
      );
    }
    if (response.status >= 500) {
      route.breaker.failure();
      throw new UpstreamError(service, response.status, `${service} failed`);
    }
    route.breaker.success();
    if (!response.ok) {
      throw new UpstreamError(service, response.status, await response.text());
    }
    return (await response.json()) as T;
  }
}
