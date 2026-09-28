import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import {
  ServicesRegistry,
  ServiceName,
} from '../registry/services.registry.js';
import { UpstreamClient } from '../registry/upstream.client.js';

interface OpenApiDocument {
  servers?: { url: string }[];
  paths: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Serves each service's OpenAPI document rewritten to go through the gateway, so the
 * gateway's Swagger UI can "try it out" against every service from one page.
 */
@ApiExcludeController()
@Controller('api/docs')
export class DocsController {
  constructor(
    private readonly registry: ServicesRegistry,
    private readonly upstream: UpstreamClient,
  ) {}

  @Get(':service/openapi.json')
  async document(@Param('service') service: string) {
    if (!this.registry.get(service)) throw new NotFoundException();
    const doc = await this.upstream.getJson<OpenApiDocument>(
      service as ServiceName,
      '/openapi.json',
      { timeoutMs: 8000 },
    );
    const paths = Object.fromEntries(
      Object.entries(doc.paths).filter(([path]) => path !== '/health'),
    );
    return { ...doc, servers: [{ url: '/api' }], paths };
  }
}
