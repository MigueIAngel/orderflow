import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { MessagingSettings } from '../messaging/messaging.settings.js';
import { StreamsClient } from '../messaging/streams.client.js';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly streams: StreamsClient,
    private readonly settings: MessagingSettings,
  ) {}

  @Get()
  async check() {
    const checks: Record<string, 'up' | 'down'> = {};
    try {
      await this.dataSource.query('SELECT 1');
      checks.database = 'up';
    } catch {
      checks.database = 'down';
    }
    if (this.settings.enabled) {
      checks.redis = (await this.streams.ping()) ? 'up' : 'down';
    }
    const status = Object.values(checks).every((c) => c === 'up')
      ? 'up'
      : 'degraded';
    return { status, service: 'orders', checks };
  }
}
