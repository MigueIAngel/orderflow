import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { ServerResponse } from 'node:http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import type { ServiceRoute } from '../registry/services.registry.js';

const logger = new Logger('Proxy');

/** Paths the gateway answers itself even though they live under a service prefix. */
const GATEWAY_OWNED = [/^\/api\/orders\/[^/]+\/summary\/?$/];

function sendUnavailable(
  res: ServerResponse,
  route: ServiceRoute,
  reason: string,
) {
  if (res.headersSent) {
    res.end();
    return;
  }
  const retryAfter = Math.ceil(route.breaker.retryAfterMs() / 1000);
  res.writeHead(503, {
    'Content-Type': 'application/json',
    ...(retryAfter > 0 && { 'Retry-After': String(retryAfter) }),
  });
  res.end(
    JSON.stringify({
      statusCode: 503,
      message: `The ${route.name} service is unavailable`,
      reason,
      service: route.name,
    }),
  );
}

/**
 * `/api/<prefix>/...` → `<service url>/<prefix>/...`, with a circuit breaker in front and
 * upstream 5xx / network errors counted as failures.
 */
export function createServiceProxy(route: ServiceRoute) {
  const owns = (path: string) =>
    route.prefixes.some(
      (p) => path === `/api${p}` || path.startsWith(`/api${p}/`),
    ) && !GATEWAY_OWNED.some((re) => re.test(path));

  const proxy = createProxyMiddleware<Request, Response>({
    target: route.url,
    changeOrigin: true,
    pathFilter: (path) => owns(path),
    pathRewrite: (path) => path.replace(/^\/api/, ''),
    ...(!route.streaming && { proxyTimeout: 10_000, timeout: 10_000 }),
    on: {
      proxyRes: (proxyRes) => {
        if ((proxyRes.statusCode ?? 500) >= 500) route.breaker.failure();
        else route.breaker.success();
      },
      error: (error, _req, res) => {
        route.breaker.failure();
        logger.warn(`${route.name}: ${error.message}`);
        if ('writeHead' in res) sendUnavailable(res, route, 'upstream_error');
      },
    },
  });

  return (req: Request, res: Response, next: NextFunction) => {
    if (owns(req.path) && !route.breaker.canRequest()) {
      sendUnavailable(res, route, 'circuit_open');
      return;
    }
    return proxy(req, res, next);
  };
}
