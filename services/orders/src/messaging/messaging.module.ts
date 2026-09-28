import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboxMessage, ProcessedEvent } from './messaging.entities.js';
import { MessagingSettings } from './messaging.settings.js';
import { OutboxService } from './outbox.service.js';
import { StreamConsumer } from './stream-consumer.service.js';
import { RedisStreamsClient, StreamsClient } from './streams.client.js';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([OutboxMessage, ProcessedEvent])],
  providers: [
    {
      provide: MessagingSettings,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        MessagingSettings.fromConfig(config),
    },
    {
      provide: StreamsClient,
      inject: [MessagingSettings],
      useFactory: (settings: MessagingSettings) =>
        new RedisStreamsClient(settings.redisUrl),
    },
    OutboxService,
    StreamConsumer,
  ],
  exports: [MessagingSettings, StreamsClient, OutboxService, StreamConsumer],
})
export class MessagingModule implements OnApplicationShutdown {
  constructor(@Inject(StreamsClient) private readonly streams: StreamsClient) {}

  async onApplicationShutdown() {
    await this.streams.close();
  }
}
