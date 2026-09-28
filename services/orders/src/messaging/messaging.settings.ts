import { hostname } from 'node:os';
import { ConfigService } from '@nestjs/config';

export class MessagingSettings {
  enabled: boolean;
  redisUrl: string;
  stream: string;
  group: string;
  consumer: string;
  processingDelayMs: number;
  maxAttempts: number;

  static fromConfig(config: ConfigService): MessagingSettings {
    return {
      enabled: config.get('MESSAGING_ENABLED', 'true') === 'true',
      redisUrl: config.get('REDIS_URL', 'redis://localhost:6379/0'),
      stream: config.get('EVENTS_STREAM', 'orderflow:events'),
      group: config.get('CONSUMER_GROUP', 'orders'),
      consumer: config.get('CONSUMER_NAME', hostname()),
      processingDelayMs: Number(config.get('PROCESSING_DELAY_MS', '300')),
      maxAttempts: 5,
    };
  }
}
