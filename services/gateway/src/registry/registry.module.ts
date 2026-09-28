import { Global, Module } from '@nestjs/common';
import { ServicesRegistry } from './services.registry.js';
import { UpstreamClient } from './upstream.client.js';

@Global()
@Module({
  providers: [ServicesRegistry, UpstreamClient],
  exports: [ServicesRegistry, UpstreamClient],
})
export class RegistryModule {}
