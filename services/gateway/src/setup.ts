import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { rateLimit } from './common/rate-limit.js';
import { requestId } from './common/request-id.middleware.js';
import { createServiceProxy } from './proxy/service-proxy.js';
import { ServicesRegistry } from './registry/services.registry.js';

/**
 * Middleware order matters: request id → rate limit → proxies → Nest routes.
 * The app is created with `bodyParser: false` so proxied request bodies stream untouched.
 */
export function configureApp(app: INestApplication) {
  const config = app.get(ConfigService);
  const registry = app.get(ServicesRegistry);

  app.enableCors({ exposedHeaders: ['x-request-id', 'Retry-After'] });
  app.enableShutdownHooks();
  app.use(requestId);
  const ordersLimit = rateLimit({
    limit: Number(config.get('RATE_LIMIT_ORDERS_PER_MIN', '30')),
    windowMs: 60_000,
  });
  app.use('/api/orders', (req: Request, res: Response, next: NextFunction) =>
    req.method === 'POST' && req.path === '/'
      ? ordersLimit(req, res, next)
      : next(),
  );
  for (const route of registry.routes) app.use(createServiceProxy(route));

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('OrderFlow · API gateway')
      .setDescription(
        'Single entry point for the OrderFlow microservices. Use the selector at the top ' +
          'right to browse the API of each service; requests go through this gateway.',
      )
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'openapi.json',
    explorer: true,
    swaggerOptions: {
      urls: [
        { url: '/openapi.json', name: 'gateway' },
        ...registry.routes.map((r) => ({
          url: `/api/docs/${r.name}/openapi.json`,
          name: r.name,
        })),
      ],
    },
  });
}
