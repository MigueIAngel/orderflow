import { Redis } from 'ioredis';

export interface StreamEntry {
  id: string;
  fields: Record<string, string>;
}

export interface ReadOptions {
  /** Re-read entries delivered to this consumer but never acknowledged. */
  pending?: boolean;
  blockMs?: number;
  count?: number;
}

/** The subset of Redis Streams the service needs. Swapped for an in-memory fake in tests. */
export abstract class StreamsClient {
  abstract publish(
    stream: string,
    fields: Record<string, string>,
  ): Promise<string>;
  abstract ensureGroup(stream: string, group: string): Promise<void>;
  abstract readGroup(
    stream: string,
    group: string,
    consumer: string,
    options?: ReadOptions,
  ): Promise<StreamEntry[]>;
  abstract ack(stream: string, group: string, id: string): Promise<void>;
  abstract ping(): Promise<boolean>;
  abstract close(): Promise<void>;
}

const MAX_STREAM_LENGTH = '10000';

type XReadGroupReply = [string, [string, string[]][]][] | null;

export class RedisStreamsClient extends StreamsClient {
  private readonly writer: Redis;
  /** XREADGROUP BLOCK holds its connection, so reads get their own. */
  private readonly reader: Redis;

  constructor(url: string) {
    super();
    // RESP2 keeps XREADGROUP replies as nested arrays (RESP3 returns maps).
    const options = { lazyConnect: true, protocol: 2 as const };
    this.writer = new Redis(url, options);
    this.reader = new Redis(url, options);
  }

  async publish(stream: string, fields: Record<string, string>) {
    const id = await this.writer.call(
      'XADD',
      stream,
      'MAXLEN',
      '~',
      MAX_STREAM_LENGTH,
      '*',
      ...Object.entries(fields).flat(),
    );
    return id as string;
  }

  async ensureGroup(stream: string, group: string) {
    try {
      // "0" so a group created late still sees earlier events.
      await this.writer.call(
        'XGROUP',
        'CREATE',
        stream,
        group,
        '0',
        'MKSTREAM',
      );
    } catch (error) {
      if (!String(error).includes('BUSYGROUP')) throw error;
    }
  }

  async readGroup(
    stream: string,
    group: string,
    consumer: string,
    { pending = false, blockMs = 2000, count = 20 }: ReadOptions = {},
  ) {
    const args: (string | number)[] = [
      'GROUP',
      group,
      consumer,
      'COUNT',
      count,
    ];
    if (!pending) args.push('BLOCK', blockMs);
    args.push('STREAMS', stream, pending ? '0' : '>');
    const reply = (await this.reader.call(
      'XREADGROUP',
      ...args,
    )) as XReadGroupReply;
    return (reply ?? []).flatMap(([, entries]) =>
      entries.map(([id, flat]) => ({ id, fields: toRecord(flat ?? []) })),
    );
  }

  async ack(stream: string, group: string, id: string) {
    await this.writer.call('XACK', stream, group, id);
  }

  async ping() {
    try {
      return (await this.writer.ping()) === 'PONG';
    } catch {
      return false;
    }
  }

  async close() {
    this.reader.disconnect();
    await this.writer.quit().catch(() => undefined);
  }
}

function toRecord(flat: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  for (let i = 0; i < flat.length; i += 2) record[flat[i]] = flat[i + 1];
  return record;
}
